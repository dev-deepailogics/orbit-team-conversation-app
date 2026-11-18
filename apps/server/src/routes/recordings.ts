import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { storageDriver } from '../services/storage.js';
import { verifyWorkspaceMember, verifyChannelAccess, canUserAccessChannel } from '../utils/security.js';

const RECORDING_INCLUDE = {
  attachment: true,
  creator: {
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  },
} as const;

export const recordingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Upload a recording (screen/webcam/audio capture, recorded client-side via MediaRecorder)
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No recording file provided in multipart request' });
    }

    const fields = (data.fields as { [key: string]: any }) || {};
    const field = (key: string) => (request.query as any)?.[key] ?? fields[key]?.value ?? fields[key] ?? null;

    let workspaceId: string | null = field('workspaceId');
    const channelId: string | null = field('channelId');
    const title: string = (field('title') || 'Untitled recording').toString().slice(0, 200);
    const durationSecRaw = field('durationSec');
    const durationSec = durationSecRaw ? Math.max(0, Math.round(Number(durationSecRaw))) : null;

    if (!workspaceId && channelId) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { workspaceId: true } });
      if (channel?.workspaceId) workspaceId = channel.workspaceId;
    }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required for recordings' });
    }

    const access = await verifyWorkspaceMember(userId, workspaceId, reply);
    if (!access) return;

    if (channelId) {
      const canAccess = await canUserAccessChannel(userId, channelId);
      if (!canAccess) {
        return reply.status(403).send({ error: 'You do not have access to this channel' });
      }
    }

    // A thumbnail is captured client-side (canvas frame grab) and uploaded as a
    // sibling field so recordings never need a server-side transcoding step.
    const thumbnailDataUrl: string | null = field('thumbnailDataUrl');
    let thumbnailUrl: string | null = null;
    if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image/')) {
      const match = thumbnailDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (match) {
        const [, ext, base64] = match;
        const buffer = Buffer.from(base64, 'base64');
        const { Readable } = await import('stream');
        const thumbResult = await storageDriver.uploadFile({
          stream: Readable.from(buffer),
          fileName: `thumbnail.${ext === 'jpg' ? 'jpeg' : ext}`,
          mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          workspaceId,
          channelId: channelId || undefined,
        });
        thumbnailUrl = thumbResult.fileUrl;
      }
    }

    try {
      const originalFileName = data.filename || 'recording.webm';
      const mimeType = data.mimetype || 'video/webm';

      const uploadResult = await storageDriver.uploadFile({
        stream: data.file,
        fileName: originalFileName,
        mimeType,
        workspaceId,
        channelId: channelId || undefined,
      });

      const recording = await prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            workspaceId,
            channelId: channelId || undefined,
            uploaderId: userId,
            fileName: originalFileName,
            fileKey: uploadResult.fileKey,
            fileUrl: uploadResult.fileUrl,
            fileType: mimeType,
            fileSize: uploadResult.fileSize,
            storageProvider: uploadResult.storageProvider,
          },
        });

        return tx.recording.create({
          data: {
            workspaceId,
            channelId: channelId || undefined,
            creatorId: userId,
            title,
            attachmentId: attachment.id,
            thumbnailUrl: thumbnailUrl || undefined,
            durationSec: durationSec || undefined,
          },
          include: RECORDING_INCLUDE,
        });
      });

      if (fastify.io && channelId) {
        fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.RECORDING_NEW, recording);
      }
      if (fastify.io) {
        fastify.io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.RECORDING_NEW, recording);
      }

      return reply.status(201).send(recording);
    } catch (err) {
      fastify.log.error(err, 'Failed to upload recording');
      return reply.status(500).send({ error: 'Failed to process recording upload' });
    }
  });

  // 2. Attach an existing (standalone) recording to a message once it's sent
  fastify.post('/:recordingId/attach', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { messageId } = request.body as { messageId: string };
    const userId = (request.user as { id: string }).id;

    if (!messageId) {
      return reply.status(400).send({ error: 'messageId is required' });
    }

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording || recording.isDeleted) {
      return reply.status(404).send({ error: 'Recording not found' });
    }
    if (recording.creatorId !== userId) {
      return reply.status(403).send({ error: 'Only the recording creator can attach it to a message' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, channelId: true } });
    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    const updated = await prisma.recording.update({
      where: { id: recordingId },
      data: { messageId, channelId: recording.channelId || message.channelId },
      include: RECORDING_INCLUDE,
    });

    return reply.send(updated);
  });

  // 3. List recordings for a channel
  fastify.get('/channel/:channelId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const recordings = await prisma.recording.findMany({
      where: { channelId, isDeleted: false },
      include: RECORDING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(recordings);
  });

  // 3b. Video Library — every recording in a workspace the caller can see, with
  // simple sort/search for the library UI (mirrors Loom's "Videos" list).
  fastify.get('/workspace/:workspaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;
    const { sort, search, mine } = request.query as { sort?: string; search?: string; mine?: string };

    const access = await verifyWorkspaceMember(userId, workspaceId, reply);
    if (!access) return;

    const recordings = await prisma.recording.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(mine === '1' ? { creatorId: userId } : {}),
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: RECORDING_INCLUDE,
      orderBy:
        sort === 'oldest'
          ? { createdAt: 'asc' }
          : sort === 'most_viewed'
          ? { viewCount: 'desc' }
          : { createdAt: 'desc' },
    });

    return reply.send(recordings);
  });

  // 4. Get a single recording by id (used by the in-app viewer)
  fastify.get('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({ where: { id: recordingId }, include: RECORDING_INCLUDE });
    if (!recording || recording.isDeleted) {
      return reply.status(404).send({ error: 'Recording not found' });
    }

    const access = await verifyWorkspaceMember(userId, recording.workspaceId, reply);
    if (!access) return;

    if (recording.channelId) {
      const canAccess = await canUserAccessChannel(userId, recording.channelId);
      if (!canAccess) {
        return reply.status(403).send({ error: 'You do not have access to this recording' });
      }
    }

    return reply.send(recording);
  });

  // 5. Public share view by slug — no auth; this is the whole point of a shareable clip link
  fastify.get('/share/:shareSlug', async (request, reply) => {
    const { shareSlug } = request.params as { shareSlug: string };

    const recording = await prisma.recording.findUnique({ where: { shareSlug }, include: RECORDING_INCLUDE });
    if (!recording || recording.isDeleted) {
      return reply.status(404).send({ error: 'Recording not found' });
    }

    await prisma.recording.update({ where: { id: recording.id }, data: { viewCount: { increment: 1 } } });

    return reply.send(recording);
  });

  // 6. Rename a recording
  fastify.patch('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { title } = request.body as { title?: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording || recording.isDeleted) {
      return reply.status(404).send({ error: 'Recording not found' });
    }
    if (recording.creatorId !== userId) {
      return reply.status(403).send({ error: 'Only the recording creator can rename it' });
    }
    if (!title || !title.trim()) {
      return reply.status(400).send({ error: 'title is required' });
    }

    const updated = await prisma.recording.update({
      where: { id: recordingId },
      data: { title: title.trim().slice(0, 200) },
      include: RECORDING_INCLUDE,
    });

    if (fastify.io) {
      if (updated.channelId) fastify.io.to(`channel:${updated.channelId}`).emit(SOCKET_EVENTS.RECORDING_UPDATE, updated);
      fastify.io.to(`workspace:${updated.workspaceId}`).emit(SOCKET_EVENTS.RECORDING_UPDATE, updated);
    }

    return reply.send(updated);
  });

  // 7. Delete a recording (soft-delete, same convention as Attachment)
  fastify.delete('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: { workspace: { include: { members: { where: { userId } } } }, attachment: true },
    });
    if (!recording || recording.isDeleted) {
      return reply.status(404).send({ error: 'Recording not found' });
    }

    const callerUser = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    const isSuperAdmin = callerUser?.systemRole === 'SUPER_ADMIN';
    const member = recording.workspace?.members?.[0];
    const isOwnerOrAdmin = member?.role === 'OWNER' || member?.role === 'ADMIN';
    const isCreator = recording.creatorId === userId;

    if (!isCreator && !isOwnerOrAdmin && !isSuperAdmin) {
      return reply.status(403).send({ error: 'You do not have permission to delete this recording' });
    }

    await storageDriver.deleteFile(recording.attachment.fileKey);

    await prisma.$transaction([
      prisma.recording.update({ where: { id: recordingId }, data: { isDeleted: true } }),
      prisma.attachment.update({ where: { id: recording.attachmentId }, data: { isDeleted: true } }),
    ]);

    if (fastify.io) {
      const payload = { recordingId: recording.id, channelId: recording.channelId, workspaceId: recording.workspaceId };
      if (recording.channelId) fastify.io.to(`channel:${recording.channelId}`).emit(SOCKET_EVENTS.RECORDING_DELETE, payload);
      fastify.io.to(`workspace:${recording.workspaceId}`).emit(SOCKET_EVENTS.RECORDING_DELETE, payload);
    }

    return reply.send({ success: true, recordingId: recording.id });
  });
};
