import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { audit } from '../services/audit.js';
import { prisma, Prisma } from '@orbit/db';
import { RECORDING_LIMITS, RecordingViewedEvent, RecordingViewers, SOCKET_EVENTS } from '@orbit/types';
import { Readable } from 'stream';
import { storageDriver } from '../services/storage.js';
import { verifyWorkspaceMember, verifyChannelAccess, canUserAccessChannel } from '../utils/security.js';

const RECORDING_INCLUDE = {
  attachment: true,
  creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  channel: { select: { id: true, name: true, type: true } },
} satisfies Prisma.RecordingInclude;

// Public link view: only what a player needs. No storage internals (fileKey, provider), no channel.
const PUBLIC_RECORDING_SELECT = {
  id: true,
  workspaceId: true,
  creatorId: true,
  title: true,
  thumbnailUrl: true,
  durationSec: true,
  shareSlug: true,
  viewCount: true,
  createdAt: true,
  attachmentId: true,
  attachment: { select: { id: true, fileUrl: true, fileType: true, fileSize: true, fileName: true } },
  creator: { select: { id: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.RecordingSelect;

type RecordingWithChannel = Prisma.RecordingGetPayload<{ include: typeof RECORDING_INCLUDE }>;

const LIBRARY_PAGE_DEFAULT = 48;
const LIBRARY_PAGE_MAX = 100;
// Client clocks and encoder flushes can overshoot the limit by a moment; reject anything beyond this.
const DURATION_GRACE_SEC = 5;
const THUMBNAIL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_THUMBNAIL_BYTES = 512 * 1024;
const MAX_AUDIENCE_CHANNELS = 50;
const VIEWER_USER_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } satisfies Prisma.UserSelect;

/** The signed-in user on a public route, or null. Never rejects: an anonymous or expired token is just "anonymous". */
async function optionalUserId(request: FastifyRequest): Promise<string | null> {
  if (!request.headers.authorization || typeof request.jwtVerify !== 'function') return null;
  try {
    await request.jwtVerify();
    return (request.user as { id?: string } | undefined)?.id ?? null;
  } catch {
    return null;
  }
}

/** A recording is visible to a user if it is workspace-wide, in a public channel, or in a channel they belong to. */
const visibleTo = (userId: string): Prisma.RecordingWhereInput => ({
  OR: [
    { channelId: null },
    { channel: { type: 'PUBLIC' } },
    { channel: { members: { some: { userId } } } },
  ],
});

const baseMimeType = (mime?: string | null) => (mime || '').split(';')[0].trim().toLowerCase();
const fileKeyFromUrl = (url?: string | null) =>
  url?.startsWith('/api/files/download/') ? decodeURIComponent(url.slice('/api/files/download/'.length)) : null;

export const recordingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * Realtime fan-out. Private/DM recordings go only to their channel room; only workspace-wide and
   * public-channel recordings are announced to the whole workspace (the Video Library listens there).
   */
  const broadcast = (event: string, recording: RecordingWithChannel) => {
    if (!fastify.io) return;
    if (recording.channelId) fastify.io.to(`channel:${recording.channelId}`).emit(event, recording);
    if (!recording.channel || recording.channel.type === 'PUBLIC') {
      fastify.io.to(`workspace:${recording.workspaceId}`).emit(event, recording);
    }
  };

  // 1. Upload a recording (screen/webcam capture, recorded client-side via MediaRecorder)
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;

    // Per-route cap overrides the global upload limit: a 5-minute clip is larger than an ordinary attachment.
    const data = await request.file({ limits: { fileSize: RECORDING_LIMITS.maxBytes } });
    if (!data) {
      return reply.status(400).send({ error: 'No recording file provided in multipart request' });
    }

    // Any early rejection must still drain the file stream, or the request never completes.
    const reject = (res: FastifyReply, status: number, error: string) => {
      data.file.resume();
      return res.status(status).send({ error });
    };

    const fields = (data.fields as Record<string, any>) || {};
    const field = (key: string): string | null => {
      const v = fields[key]?.value ?? fields[key];
      return typeof v === 'string' ? v : null;
    };

    const mimeType = baseMimeType(data.mimetype);
    if (!(RECORDING_LIMITS.allowedMimeTypes as readonly string[]).includes(mimeType)) {
      // Never store arbitrary types as "recordings": files are served inline, so HTML/SVG would be an XSS vector.
      return reject(reply, 415, 'Recordings must be WebM or MP4 video');
    }

    let workspaceId = field('workspaceId');
    const channelId = field('channelId');
    const title = (field('title') || '').trim().slice(0, 200) || 'Untitled recording';

    const durationRaw = Number(field('durationSec'));
    const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : null;
    if (durationSec !== null && durationSec > RECORDING_LIMITS.maxDurationSec + DURATION_GRACE_SEC) {
      return reject(reply, 400, `Recordings can be at most ${RECORDING_LIMITS.maxDurationSec / 60} minutes long`);
    }

    let channel: { workspaceId: string; isAnonymous: boolean } | null = null;
    if (channelId) {
      channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { workspaceId: true, isAnonymous: true } });
      if (!channel) return reject(reply, 404, 'Channel not found');
      workspaceId ??= channel.workspaceId;
      if (channel.workspaceId !== workspaceId) return reject(reply, 400, 'Channel does not belong to this workspace');
      // A recording carries its creator, which would unmask an anonymous poster.
      if (channel.isAnonymous) return reject(reply, 400, 'Recordings cannot be shared in anonymous channels');
    }
    if (!workspaceId) return reject(reply, 400, 'workspaceId is required for recordings');

    const isMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { userId: true },
    });
    if (!isMember) return reject(reply, 403, 'You are not a member of this workspace');
    if (channelId && !(await canUserAccessChannel(userId, channelId))) {
      return reject(reply, 403, 'You do not have access to this channel');
    }

    // Thumbnail (a client-side frame grab) is validated now but stored only after the video succeeds.
    let thumbnail: { buffer: Buffer; ext: string } | null = null;
    const thumbMatch = field('thumbnailDataUrl')?.match(THUMBNAIL_PATTERN);
    if (thumbMatch) {
      const buffer = Buffer.from(thumbMatch[2], 'base64');
      if (buffer.length <= MAX_THUMBNAIL_BYTES) thumbnail = { buffer, ext: thumbMatch[1] === 'jpg' ? 'jpeg' : thumbMatch[1] };
    }

    const storedKeys: string[] = [];
    try {
      const video = await storageDriver.uploadFile({
        stream: data.file,
        fileName: `recording.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`,
        mimeType,
        workspaceId,
        channelId: channelId || undefined,
      });
      storedKeys.push(video.fileKey);
      if (data.file.truncated) {
        throw Object.assign(new Error('Recording exceeds the size limit'), { code: 'FST_REQ_FILE_TOO_LARGE' });
      }

      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        const thumb = await storageDriver.uploadFile({
          stream: Readable.from(thumbnail.buffer),
          fileName: `thumbnail.${thumbnail.ext}`,
          mimeType: `image/${thumbnail.ext}`,
          workspaceId,
          channelId: channelId || undefined,
        });
        storedKeys.push(thumb.fileKey);
        thumbnailUrl = thumb.fileUrl;
      }

      const recording = await prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            workspaceId: workspaceId!,
            channelId: channelId || undefined,
            uploaderId: userId,
            fileName: `${title}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`,
            fileKey: video.fileKey,
            fileUrl: video.fileUrl,
            fileType: mimeType,
            fileSize: video.fileSize,
            storageProvider: video.storageProvider,
          },
        });
        return tx.recording.create({
          data: {
            workspaceId: workspaceId!,
            channelId: channelId || undefined,
            creatorId: userId,
            title,
            attachmentId: attachment.id,
            thumbnailUrl,
            durationSec: durationSec === null ? null : Math.min(durationSec, RECORDING_LIMITS.maxDurationSec),
          },
          include: RECORDING_INCLUDE,
        });
      });

      broadcast(SOCKET_EVENTS.RECORDING_NEW, recording);
      return reply.status(201).send(recording);
    } catch (err: any) {
      // Nothing half-saved: remove whatever reached storage before the failure.
      await Promise.all(storedKeys.map((k) => storageDriver.deleteFile(k)));
      if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({ error: `Recording is larger than ${RECORDING_LIMITS.maxBytes / (1024 * 1024)} MB` });
      }
      fastify.log.error(err, 'Failed to upload recording');
      return reply.status(500).send({ error: 'Failed to process recording upload' });
    }
  });

  // 2. Link a recording to the chat message it was posted in (only your own recording + your own message)
  fastify.post('/:recordingId/attach', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { messageId } = (request.body as { messageId?: string }) || {};
    const userId = (request.user as { id: string }).id;

    if (!messageId) return reply.status(400).send({ error: 'messageId is required' });

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording || recording.isDeleted) return reply.status(404).send({ error: 'Recording not found' });
    if (recording.creatorId !== userId) {
      return reply.status(403).send({ error: 'Only the recording creator can attach it to a message' });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, userId: true, channelId: true, channel: { select: { workspaceId: true } } },
    });
    if (!message || message.userId !== userId) return reply.status(404).send({ error: 'Message not found' });
    if (message.channel.workspaceId !== recording.workspaceId) {
      return reply.status(400).send({ error: 'Message is in a different workspace' });
    }
    // A recording keeps the audience it was uploaded for; it can't be re-homed into another channel.
    if (recording.channelId && recording.channelId !== message.channelId) {
      return reply.status(400).send({ error: 'Message is in a different channel than the recording' });
    }

    const updated = await prisma.recording.update({
      where: { id: recordingId },
      data: { messageId },
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
      take: LIBRARY_PAGE_MAX,
    });
    return reply.send(recordings);
  });

  // 3b. Video Library: recordings in a workspace the caller can see, paginated, with sort/search.
  fastify.get('/workspace/:workspaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;
    const q = request.query as { sort?: string; search?: string; mine?: string; limit?: string; offset?: string };

    const access = await verifyWorkspaceMember(userId, workspaceId, reply);
    if (!access) return;

    const limit = Math.min(Math.max(Number(q.limit) || LIBRARY_PAGE_DEFAULT, 1), LIBRARY_PAGE_MAX);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const search = q.search?.trim().slice(0, 100);

    const rows = await prisma.recording.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(q.mine === '1' ? { creatorId: userId } : {}),
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        AND: [visibleTo(userId)],
      },
      include: RECORDING_INCLUDE,
      orderBy:
        q.sort === 'oldest'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : q.sort === 'most_viewed'
          ? [{ viewCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1, // one extra row tells us whether another page exists
    });

    return reply.send({ recordings: rows.slice(0, limit), hasMore: rows.length > limit });
  });

  // 4. Get a single recording by id (in-app viewer)
  fastify.get('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({ where: { id: recordingId }, include: RECORDING_INCLUDE });
    if (!recording || recording.isDeleted) return reply.status(404).send({ error: 'Recording not found' });

    const access = await verifyWorkspaceMember(userId, recording.workspaceId, reply);
    if (!access) return;
    if (recording.channelId && !(await canUserAccessChannel(userId, recording.channelId))) {
      return reply.status(403).send({ error: 'You do not have access to this recording' });
    }
    return reply.send(recording);
  });

  // 5. Public share view by slug. No auth: an unguessable link is the point of a shareable clip.
  // Read-only: rendering a chat embed must not count as a view (that inflated counts on every scroll).
  fastify.get('/share/:shareSlug', async (request, reply) => {
    const { shareSlug } = request.params as { shareSlug: string };
    const recording = await prisma.recording.findFirst({
      where: { shareSlug, isDeleted: false },
      select: PUBLIC_RECORDING_SELECT,
    });
    if (!recording) return reply.status(404).send({ error: 'Recording not found' });
    return reply.send(recording);
  });

  // 5b. Count a view, sent once per player when playback actually starts. Public like the link itself;
  // when the viewer is signed in to this workspace they're also recorded for the creator's "Seen by" list.
  fastify.post('/share/:shareSlug/view', async (request, reply) => {
    const { shareSlug } = request.params as { shareSlug: string };
    const recording = await prisma.recording.findFirst({
      where: { shareSlug, isDeleted: false },
      select: { id: true, workspaceId: true, creatorId: true },
    });
    if (!recording) return reply.status(404).send({ error: 'Recording not found' });

    const viewerId = await optionalUserId(request);
    if (viewerId && viewerId === recording.creatorId) return reply.status(204).send(); // watching your own clip isn't a view

    const { viewCount } = await prisma.recording.update({
      where: { id: recording.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });

    if (viewerId) {
      const isMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: recording.workspaceId, userId: viewerId } },
        select: { userId: true },
      });
      if (isMember) {
        await prisma.recordingView
          .upsert({
            where: { recordingId_userId: { recordingId: recording.id, userId: viewerId } },
            create: { recordingId: recording.id, userId: viewerId },
            update: { lastViewedAt: new Date(), plays: { increment: 1 } },
          })
          .catch((err) => fastify.log.warn(err, 'Failed to record recording viewer')); // a lost receipt must not fail playback
      }
    }

    if (recording.creatorId && fastify.io) {
      const payload: RecordingViewedEvent = { recordingId: recording.id, viewCount };
      fastify.io.to(`user:${recording.creatorId}`).emit(SOCKET_EVENTS.RECORDING_VIEWED, payload);
    }
    return reply.status(204).send();
  });

  // 5c. "Seen by": who played the clip, and who it was shared with that hasn't yet. Creator only,
  // like a read receipt. Audience = the clip's channel plus every conversation the creator posted its link in.
  fastify.get('/:recordingId/viewers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        id: true, workspaceId: true, channelId: true, creatorId: true, shareSlug: true,
        viewCount: true, createdAt: true, isDeleted: true, message: { select: { channelId: true } },
      },
    });
    if (!recording || recording.isDeleted) return reply.status(404).send({ error: 'Recording not found' });
    if (recording.creatorId !== userId) {
      return reply.status(403).send({ error: 'Only the recording creator can see who viewed it' });
    }

    const linkPosts = await prisma.message.findMany({
      where: {
        userId,
        isDeleted: false,
        createdAt: { gte: recording.createdAt },
        content: { contains: `/clip/${recording.shareSlug}` },
      },
      select: { channelId: true },
      distinct: ['channelId'],
      take: MAX_AUDIENCE_CHANNELS,
    });
    const channelIds = [
      ...new Set([recording.channelId, recording.message?.channelId, ...linkPosts.map((m) => m.channelId)].filter((id): id is string => !!id)),
    ];

    const [channels, views] = await Promise.all([
      prisma.channel.findMany({
        where: { id: { in: channelIds }, workspaceId: recording.workspaceId },
        select: { id: true, name: true, type: true, members: { select: { user: { select: VIEWER_USER_SELECT } } } },
      }),
      prisma.recordingView.findMany({
        where: { recordingId },
        select: { firstViewedAt: true, lastViewedAt: true, plays: true, user: { select: VIEWER_USER_SELECT } },
        orderBy: { lastViewedAt: 'desc' },
      }),
    ]);

    const seenIds = new Set(views.map((v) => v.user.id));
    const notSeen = new Map<string, (typeof views)[number]['user']>();
    for (const c of channels) {
      for (const { user } of c.members) {
        if (user.id !== userId && !seenIds.has(user.id)) notSeen.set(user.id, user);
      }
    }

    const body: RecordingViewers = {
      viewCount: recording.viewCount,
      sharedIn: channels.map((c) => ({
        id: c.id,
        type: c.type,
        name:
          c.type === 'DIRECT' || c.type === 'GROUP_DIRECT'
            ? c.members.filter((m) => m.user.id !== userId).map((m) => m.user.displayName || m.user.username).join(', ') || 'Direct message'
            : c.name,
      })),
      seen: views.map((v) => ({
        user: v.user,
        firstViewedAt: v.firstViewedAt.toISOString(),
        lastViewedAt: v.lastViewedAt.toISOString(),
        plays: v.plays,
      })),
      notSeen: [...notSeen.values()].sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username)),
    };
    return reply.send(body);
  });

  // 6. Rename a recording (creator only)
  fastify.patch('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const { title } = (request.body as { title?: unknown }) || {};
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording || recording.isDeleted) return reply.status(404).send({ error: 'Recording not found' });
    if (recording.creatorId !== userId) {
      return reply.status(403).send({ error: 'Only the recording creator can rename it' });
    }
    if (typeof title !== 'string' || !title.trim()) return reply.status(400).send({ error: 'title is required' });

    const updated = await prisma.recording.update({
      where: { id: recordingId },
      data: { title: title.trim().slice(0, 200) },
      include: RECORDING_INCLUDE,
    });
    broadcast(SOCKET_EVENTS.RECORDING_UPDATE, updated);
    return reply.send(updated);
  });

  // 7. Delete a recording (creator, workspace owner/admin, or super admin). Removes video + thumbnail files.
  fastify.delete('/:recordingId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as { id: string }).id;

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: { workspace: { include: { members: { where: { userId } } } }, attachment: true },
    });
    if (!recording || recording.isDeleted) return reply.status(404).send({ error: 'Recording not found' });

    const callerUser = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    const member = recording.workspace?.members?.[0];
    const allowed =
      recording.creatorId === userId ||
      member?.role === 'OWNER' ||
      member?.role === 'ADMIN' ||
      callerUser?.systemRole === 'SUPER_ADMIN';
    if (!allowed) return reply.status(403).send({ error: 'You do not have permission to delete this recording' });

    audit(request, { action: 'recording.delete', actorId: userId, workspaceId: recording.workspaceId, targetType: 'recording', targetId: recordingId });
    // Soft-delete first so the clip disappears immediately even if file cleanup is slow or fails.
    await prisma.$transaction([
      prisma.recording.update({ where: { id: recordingId }, data: { isDeleted: true } }),
      prisma.attachment.update({ where: { id: recording.attachmentId }, data: { isDeleted: true } }),
    ]);
    const thumbKey = fileKeyFromUrl(recording.thumbnailUrl);
    await Promise.all([
      storageDriver.deleteFile(recording.attachment.fileKey),
      thumbKey ? storageDriver.deleteFile(thumbKey) : Promise.resolve(false),
    ]);

    if (fastify.io) {
      // Ids only, so it is safe to announce workspace-wide.
      const payload = { recordingId: recording.id, channelId: recording.channelId, workspaceId: recording.workspaceId };
      if (recording.channelId) fastify.io.to(`channel:${recording.channelId}`).emit(SOCKET_EVENTS.RECORDING_DELETE, payload);
      fastify.io.to(`workspace:${recording.workspaceId}`).emit(SOCKET_EVENTS.RECORDING_DELETE, payload);
    }
    return reply.send({ success: true, recordingId: recording.id });
  });
};
