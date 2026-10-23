import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { LiveKitService } from '../services/livekit.js';
import { SOCKET_EVENTS } from '@orbit/types';
import { verifyChannelAccess } from '../utils/security.js';

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

    return reply.send({ success: true, huddle });
  });

  // End Huddle
  fastify.post('/:channelId/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    await prisma.huddle.updateMany({
      where: { channelId, isActive: true },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

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

