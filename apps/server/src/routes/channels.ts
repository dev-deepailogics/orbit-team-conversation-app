import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';

const createChannelSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  topic: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'DIRECT', 'GROUP_DIRECT']).default('PUBLIC'),
});

const postMessageSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
  })).optional(),
});

export const channelRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Create channel in workspace
  fastify.post('/workspaces/:workspaceId/channels', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = createChannelSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, topic, description, type } = parseResult.data;

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const channel = await prisma.channel.create({
      data: {
        workspaceId,
        name,
        topic,
        description,
        type,
        createdById: userId,
        members: {
          create: {
            userId,
          },
        },
      },
    });

    return reply.status(201).send(channel);
  });

  // Get or Create Direct Message (DM) Channel
  fastify.post('/workspaces/:workspaceId/dm', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const currentUserId = (request.user as { id: string }).id;
    const { targetUserId } = request.body as { targetUserId: string };

    if (!targetUserId) {
      return reply.status(400).send({ error: 'targetUserId is required' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Check if DM channel already exists between these 2 users in this workspace
    const existingDm = await prisma.channel.findFirst({
      where: {
        workspaceId,
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (existingDm) {
      return reply.send(existingDm);
    }

    // Create new DM channel
    const dmChannel = await prisma.channel.create({
      data: {
        workspaceId,
        name: `dm-${currentUserId.slice(0, 4)}-${targetUserId.slice(0, 4)}`,
        topic: `Direct message with ${targetUser.displayName}`,
        type: 'DIRECT',
        createdById: currentUserId,
        members: {
          create: [
            { userId: currentUserId },
            ...(currentUserId !== targetUserId ? [{ userId: targetUserId }] : []),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return reply.status(201).send(dmChannel);
  });

  // Get messages for a channel
  fastify.get('/:channelId/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { cursor, limit = '50' } = request.query as { cursor?: string; limit?: string };
    const take = parseInt(limit, 10);

    const messages = await prisma.message.findMany({
      where: {
        channelId,
        parentMessageId: null, // Root channel messages only
      },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        bot: true,
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Format response
    const formatted = messages.map((m) => ({
      ...m,
      replyCount: m._count.replies,
    })).reverse();

    return reply.send(formatted);
  });

  // Send message in channel
  fastify.post('/:channelId/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = postMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { content, attachments } = parseResult.data;

    const message = await prisma.message.create({
      data: {
        channelId,
        userId,
        content,
        attachments: attachments && attachments.length > 0 ? {
          create: attachments.map((att) => ({
            fileUrl: att.fileUrl,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
          })),
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        bot: true,
        attachments: true,
        reactions: true,
        _count: {
          select: { replies: true },
        },
      },
    });

    const payload = {
      ...message,
      replyCount: 0,
    };

    // Realtime broadcast via Socket.IO
    if (fastify.io) {
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
    }

    return reply.status(201).send(payload);
  });
};
