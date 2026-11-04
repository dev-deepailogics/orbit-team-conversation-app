import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { LiveKitService } from '../services/livekit.js';
import { SOCKET_EVENTS } from '@orbit/types';
import { verifyChannelAccess } from '../utils/security.js';
import { CALL_STARTED, notifyCallEnded, notifyCallStarted } from '../services/pushService.js';

// Same shape the channel message routes broadcast, so call records render like any message.
const messageInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
  bot: true,
  attachments: true,
  reactions: true,
} as const;

function formatDuration(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'less than a minute';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export const huddleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get LiveKit WebRTC Token for channel huddle
  fastify.post('/:channelId/token', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string; username: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const roomName = `orbit-huddle-${channel.id}`;
    const token = await LiveKitService.createToken(roomName, userPayload.id, userPayload.username);

    return reply.send({
      token,
      roomName,
      serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
    });
  });

  // Start / Join Huddle / Call
  fastify.post('/:channelId/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string; username: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
    });

    let huddle = await prisma.huddle.findFirst({
      where: { channelId, isActive: true },
    });

    const isNew = !huddle;
    if (!huddle) {
      huddle = await prisma.huddle.create({
        data: {
          channelId,
          workspaceId: channel.workspaceId,
          hostUserId: userPayload.id,
          isActive: true,
        },
      });
    }

    if (fastify.io) {
      const callData = {
        channelId,
        channelName: channel.name,
        channelType: channel.type,
        channelTopic: channel.topic,
        huddleId: huddle.id,
        hostUserId: userPayload.id,
        callerName: user?.displayName || userPayload.username,
        callerAvatar: user?.avatarUrl,
        workspaceId: channel.workspaceId,
      };

      if (channel.type === 'PUBLIC') {
        fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, callData);
      } else {
        for (const m of channel.members) {
          fastify.io.to(`user:${m.userId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, callData);
        }
      }
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, callData);
    }

    // /start also runs for every joiner; only the first one rings and leaves a record in the chat.
    if (isNew) {
      const recipients = channel.members.map((m: { userId: string }) => m.userId).filter((id: string) => id !== userPayload.id);
      notifyCallStarted(recipients, {
        channelId,
        channelName: channel.name,
        channelType: channel.type,
        callerName: user?.displayName || userPayload.username,
        hostUserId: userPayload.id,
        workspaceId: channel.workspaceId,
      }).catch((err) => console.error('Call push failed', err));

      // Anonymous channels never show who did what.
      if (!channel.isAnonymous) {
        const message = await prisma.message.create({
          data: { channelId, userId: userPayload.id, content: CALL_STARTED },
          include: messageInclude,
        });
        const payload = { ...message, replyCount: 0, workspaceId: channel.workspaceId };
        if (fastify.io) {
          if (channel.type === 'PUBLIC') {
            fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
          } else {
            for (const m of channel.members) fastify.io.to(`user:${m.userId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
            fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
          }
        }
      }
    }

    return reply.send({ success: true, huddle });
  });

  // End Huddle
  fastify.post('/:channelId/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const endedAt = new Date();
    const ending = await prisma.huddle.findMany({ where: { channelId, isActive: true } });
    await prisma.huddle.updateMany({
      where: { id: { in: ending.map((h) => h.id) } },
      data: {
        isActive: false,
        endedAt,
      },
    });

    // Turn each "Started a call" record into "Call ended · duration".
    for (const h of ending) {
      const record = await prisma.message.findFirst({
        where: { channelId, userId: h.hostUserId, content: CALL_STARTED, createdAt: { gte: h.startedAt } },
        orderBy: { createdAt: 'asc' },
      });
      if (!record) continue;
      const updated = await prisma.message.update({
        where: { id: record.id },
        data: { content: `📞 Call ended · lasted ${formatDuration(endedAt.getTime() - h.startedAt.getTime())}` },
        include: { ...messageInclude, _count: { select: { replies: true } } },
      });
      fastify.io?.to(`channel:${channelId}`).emit('message:updated', { ...updated, replyCount: updated._count.replies });
    }
    if (ending.length) {
      const members = channel.members.map((m: { userId: string }) => m.userId);
      notifyCallEnded(members, channelId).catch((err) => console.error('Call ended push failed', err));
    }

    // Clean up LiveKit room
    await LiveKitService.deleteRoom(`orbit-huddle-${channelId}`);

    if (fastify.io) {
      fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_ENDED, {
        channelId,
      });
    }

    return reply.send({ success: true });
  });

  // Get active participants for a huddle
  fastify.get('/:channelId/participants', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    const livekitParticipants = await LiveKitService.listParticipants(roomName);

    // Fetch user details for each participant
    const userIds = livekitParticipants.map((p) => p.identity);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const participants = livekitParticipants.map((p) => ({
      identity: p.identity,
      name: p.name,
      joinedAt: new Date(Number(p.joinedAt) * 1000).toISOString(),
      isMuted: p.tracks.some((t) => t.type === 0 && t.muted), // 0: AUDIO
      isVideoOn: p.tracks.some((t) => t.type === 1 && !t.muted), // 1: VIDEO
      user: userMap.get(p.identity) || null,
    }));

    return reply.send({ participants });
  });

  // Admin moderation: Mute participant
  fastify.post('/:channelId/mute-participant', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { targetUserId, trackSid, muted } = request.body as { targetUserId: string; trackSid?: string; muted?: boolean };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    const shouldMute = muted !== false;

    if (trackSid) {
      await LiveKitService.mutePublishedTrack(roomName, targetUserId, trackSid, shouldMute);
    } else {
      // Find audio track if trackSid is not specified
      const participants = await LiveKitService.listParticipants(roomName);
      const target = participants.find((p) => p.identity === targetUserId);
      const audioTrack = target?.tracks.find((t) => t.type === 0);
      if (audioTrack) {
        await LiveKitService.mutePublishedTrack(roomName, targetUserId, audioTrack.sid, shouldMute);
      }
    }

    return reply.send({ success: true });
  });

  // Admin moderation: Kick / Remove participant
  fastify.post('/:channelId/remove-participant', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { targetUserId } = request.body as { targetUserId: string };
    const userPayload = request.user as { id: string };

    const access = await verifyChannelAccess(userPayload.id, channelId, reply);
    if (!access) return;

    const roomName = `orbit-huddle-${channelId}`;
    await LiveKitService.removeParticipant(roomName, targetUserId);

    return reply.send({ success: true });
  });
};

