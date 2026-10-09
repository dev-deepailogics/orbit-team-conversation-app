import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { LiveKitService } from '../services/livekit.js';
import { SOCKET_EVENTS } from '@orbit/types';

export const huddleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get LiveKit WebRTC Token for channel huddle
  fastify.post('/:channelId/token', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userPayload = request.user as { id: string; username: string };

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    const roomName = `orbit-huddle-${channel.id}`;
    const token = await LiveKitService.createToken(roomName, userPayload.id, userPayload.username);

    return reply.send({
      token,
      roomName,
      serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
    });
  });

  // Start / Join Huddle
  fastify.post('/:channelId/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string; username: string }).id;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    let huddle = await prisma.huddle.findFirst({
      where: { channelId, isActive: true },
    });

    if (!huddle) {
      huddle = await prisma.huddle.create({
        data: {
          channelId,
          workspaceId: channel.workspaceId,
          hostUserId: userId,
          isActive: true,
        },
      });
    }

    if (fastify.io) {
      fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_STARTED, {
        channelId,
        huddleId: huddle.id,
        hostUserId: userId,
      });
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

    if (fastify.io) {
      fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.HUDDLE_ENDED, {
        channelId,
      });
    }

    return reply.send({ success: true });
  });
};
