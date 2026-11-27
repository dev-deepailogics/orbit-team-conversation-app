import { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { prisma } from '@orbit/db';
import { UPLOAD_LIMITS, uploadRejectionReason } from '@orbit/types';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { storageDriver, UPLOAD_BASE_DIR } from '../services/storage.js';
import { canUserAccessChannel } from '../utils/security.js';

/**
 * Chunked (resumable) uploads for large files.
 *
 *   POST   /init                    -> { uploadId, chunkSize, totalChunks }
 *   PUT    /:uploadId/chunks/:index  raw bytes (application/octet-stream), any order, can be retried
 *   GET    /:uploadId               -> { receivedChunks } so a client can retry only what's missing
 *   POST   /:uploadId/complete      -> joins the chunks into one stored file; same payload as POST /api/files/upload
 *   DELETE /:uploadId                cancels and removes the chunks
 *
 * Chunks live in <uploads>/.chunked/<uploadId>/ next to a meta.json; no database rows until the file is
 * attached to a message, exactly like the single-request upload. Stale sessions are swept every hour.
 */

const SESSIONS_DIR = path.join(UPLOAD_BASE_DIR, '.chunked');
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

interface UploadSession {
  uploadId: string;
  userId: string;
  workspaceId: string;
  channelId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  createdAt: number;
}

const initSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().max(255).optional(),
  workspaceId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional().nullable(),
});

const sessionDir = (uploadId: string) => path.join(SESSIONS_DIR, uploadId);
const chunkPath = (uploadId: string, index: number) => path.join(sessionDir(uploadId), `${index}.part`);
const expectedChunkSize = (s: UploadSession, index: number) =>
  Math.min(s.chunkSize, s.fileSize - index * s.chunkSize);

async function readSession(uploadId: string): Promise<UploadSession | null> {
  if (!UPLOAD_ID.test(uploadId)) return null;
  try {
    return JSON.parse(await fs.promises.readFile(path.join(sessionDir(uploadId), 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function removeSession(uploadId: string) {
  await fs.promises.rm(sessionDir(uploadId), { recursive: true, force: true });
}

/** Indexes of chunks that were fully written (a chunk only gets its final name once complete). */
async function receivedChunks(s: UploadSession): Promise<number[]> {
  const names = await fs.promises.readdir(sessionDir(s.uploadId)).catch(() => [] as string[]);
  return names
    .map((n) => /^(\d+)\.part$/.exec(n)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number)
    .filter((i) => i < s.totalChunks)
    .sort((a, b) => a - b);
}

/** Passes bytes through, failing as soon as more than `max` arrive (a chunk can't be used to fill the disk). */
function byteLimit(max: number) {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > max) cb(Object.assign(new Error('Chunk is larger than expected'), { statusCode: 400 }));
      else cb(null, chunk);
    },
  });
}

/** One readable stream over all chunk files in order, read from disk piece by piece (never all in memory). */
function concatChunks(s: UploadSession): Readable {
  return Readable.from(
    (async function* () {
      for (let i = 0; i < s.totalChunks; i++) {
        for await (const piece of fs.createReadStream(chunkPath(s.uploadId, i))) yield piece as Buffer;
      }
    })(),
  );
}

async function sweepStaleSessions(log: FastifyInstance['log']) {
  const ids = await fs.promises.readdir(SESSIONS_DIR).catch(() => [] as string[]);
  const cutoff = Date.now() - UPLOAD_LIMITS.sessionTtlMs;
  for (const id of ids) {
    const stat = await fs.promises.stat(sessionDir(id)).catch(() => null);
    if (stat && stat.mtimeMs < cutoff) {
      await removeSession(id).catch((err) => log.warn({ err, id }, 'Failed to remove stale upload session'));
    }
  }
}

export const chunkedUploadRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fs.promises.mkdir(SESSIONS_DIR, { recursive: true });

  // Chunk bodies are raw bytes. This parser is scoped to this plugin and hands the stream straight to the
  // route, so a chunk is written to disk as it arrives instead of being buffered in memory.
  fastify.addContentTypeParser('application/octet-stream', (_req, payload, done) => done(null, payload));

  sweepStaleSessions(fastify.log).catch(() => {});
  const sweeper = setInterval(() => sweepStaleSessions(fastify.log).catch(() => {}), SWEEP_INTERVAL_MS);
  sweeper.unref();
  fastify.addHook('onClose', async () => clearInterval(sweeper));

  /** Loads a session that belongs to the caller, or replies 404. */
  const ownSession = async (userId: string, uploadId: string, reply: FastifyReply) => {
    const s = await readSession(uploadId);
    if (!s || s.userId !== userId) {
      reply.status(404).send({ error: 'Upload not found or expired' });
      return null;
    }
    return s;
  };

  fastify.post('/init', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const parsed = initSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { fileName, fileSize, channelId } = parsed.data;
    let workspaceId = parsed.data.workspaceId;

    const rejection = uploadRejectionReason(fileName, fileSize);
    if (rejection) return reply.status(fileSize > UPLOAD_LIMITS.maxBytes ? 413 : 415).send({ error: rejection });

    if (channelId) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { workspaceId: true } });
      if (!channel) return reply.status(404).send({ error: 'Channel not found' });
      if (workspaceId && workspaceId !== channel.workspaceId) {
        return reply.status(400).send({ error: 'Channel does not belong to this workspace' });
      }
      workspaceId = channel.workspaceId;
      if (!(await canUserAccessChannel(userId, channelId))) {
        return reply.status(403).send({ error: 'You do not have access to this channel' });
      }
    }
    if (!workspaceId) return reply.status(400).send({ error: 'workspaceId is required for file uploads' });

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { userId: true },
    });
    if (!member) return reply.status(403).send({ error: 'You are not a member of this workspace' });

    const session: UploadSession = {
      uploadId: randomUUID(),
      userId,
      workspaceId,
      channelId: channelId || null,
      fileName,
      mimeType: parsed.data.mimeType || 'application/octet-stream',
      fileSize,
      chunkSize: UPLOAD_LIMITS.chunkBytes,
      totalChunks: Math.ceil(fileSize / UPLOAD_LIMITS.chunkBytes),
      createdAt: Date.now(),
    };
    await fs.promises.mkdir(sessionDir(session.uploadId), { recursive: true });
    await fs.promises.writeFile(path.join(sessionDir(session.uploadId), 'meta.json'), JSON.stringify(session));

    return reply.status(201).send({
      uploadId: session.uploadId,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
    });
  });

  fastify.put('/:uploadId/chunks/:index', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { uploadId, index: rawIndex } = request.params as { uploadId: string; index: string };
    const body = request.body as Readable | undefined;
    const drain = () => body?.resume?.();

    const s = await ownSession(userId, uploadId, reply);
    if (!s) return drain();
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= s.totalChunks) {
      drain();
      return reply.status(400).send({ error: 'Invalid chunk index' });
    }
    if (!body || typeof body.pipe !== 'function') {
      return reply.status(415).send({ error: 'Send the chunk as application/octet-stream' });
    }

    const expected = expectedChunkSize(s, index);
    const finalPath = chunkPath(uploadId, index);
    // Written under a temporary name and renamed when complete, so a half-written chunk never counts as received.
    const tmpPath = `${finalPath}.${randomUUID()}.tmp`;
    try {
      await pipeline(body, byteLimit(expected), fs.createWriteStream(tmpPath));
      const { size } = await fs.promises.stat(tmpPath);
      if (size !== expected) {
        throw Object.assign(new Error(`Chunk ${index} should be ${expected} bytes, got ${size}`), { statusCode: 400 });
      }
      await fs.promises.rename(tmpPath, finalPath);
    } catch (err: any) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      if (err?.statusCode === 400) return reply.status(400).send({ error: err.message });
      request.log.warn({ err, uploadId, index }, 'Chunk upload failed');
      return reply.status(500).send({ error: 'Failed to store chunk, please retry' });
    }
    return { index, received: true };
  });

  fastify.get('/:uploadId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { uploadId } = request.params as { uploadId: string };
    const s = await ownSession(userId, uploadId, reply);
    if (!s) return;
    return { uploadId, totalChunks: s.totalChunks, chunkSize: s.chunkSize, receivedChunks: await receivedChunks(s) };
  });

  fastify.post('/:uploadId/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { uploadId } = request.params as { uploadId: string };
    const s = await ownSession(userId, uploadId, reply);
    if (!s) return;

    const received = await receivedChunks(s);
    if (received.length !== s.totalChunks) {
      const have = new Set(received);
      const missing = Array.from({ length: s.totalChunks }, (_, i) => i).filter((i) => !have.has(i));
      return reply.status(409).send({ error: 'Some chunks are missing', missingChunks: missing });
    }

    // mkdir is atomic: a second "complete" for the same upload (double click, retry) is refused instead of
    // assembling the file twice.
    try {
      await fs.promises.mkdir(path.join(sessionDir(uploadId), '.completing'));
    } catch {
      return reply.status(409).send({ error: 'Upload is already being completed' });
    }

    let stored: Awaited<ReturnType<typeof storageDriver.uploadFile>> | null = null;
    try {
      stored = await storageDriver.uploadFile({
        stream: concatChunks(s),
        fileName: s.fileName,
        mimeType: s.mimeType,
        workspaceId: s.workspaceId,
        channelId: s.channelId || undefined,
      });
      if (stored.fileSize !== s.fileSize) {
        await storageDriver.deleteFile(stored.fileKey);
        await fs.promises.rmdir(path.join(sessionDir(uploadId), '.completing')).catch(() => {});
        return reply.status(400).send({ error: 'Assembled file size does not match, please upload again' });
      }
    } catch (err) {
      request.log.error({ err, uploadId }, 'Failed to assemble chunked upload');
      await fs.promises.rmdir(path.join(sessionDir(uploadId), '.completing')).catch(() => {});
      return reply.status(500).send({ error: 'Failed to finish the upload, please retry' });
    }

    await removeSession(uploadId).catch(() => {});

    const uploader = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    // Same staged-file payload as POST /api/files/upload: the row is created when the message is sent.
    return reply.status(200).send({
      workspaceId: s.workspaceId,
      channelId: s.channelId || undefined,
      uploaderId: userId,
      fileName: s.fileName,
      fileKey: stored.fileKey,
      fileUrl: stored.fileUrl,
      fileType: s.mimeType,
      fileSize: stored.fileSize,
      storageProvider: stored.storageProvider,
      uploader,
    });
  });

  fastify.delete('/:uploadId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { uploadId } = request.params as { uploadId: string };
    const s = await ownSession(userId, uploadId, reply);
    if (!s) return;
    await removeSession(uploadId);
    return { cancelled: true };
  });
};
