import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';

const threadReplySchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
  })).optional(),
});

const reactionSchema = z.object({
  emoji: z.string().min(1),
});

export const messageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Get thread replies for a parent message
  fastify.get('/:messageId/replies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };

    const parentMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    if (!parentMessage) {
      return reply.status(404).send({ error: 'Parent message not found' });
    }

    const replies = await prisma.message.findMany({
      where: { parentMessageId: messageId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    return reply.send({
      parent: parentMessage,
      replies,
    });
  });

  // Reply in thread
  fastify.post('/:messageId/replies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = threadReplySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const parent = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!parent) {
      return reply.status(404).send({ error: 'Parent message not found' });
    }

    const replyMessage = await prisma.message.create({
      data: {
        channelId: parent.channelId,
        parentMessageId: parent.id,
        userId,
        content: parseResult.data.content,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        attachments: true,
        reactions: true,
      },
    });

    // Realtime notification to channel & thread
    if (fastify.io) {
      fastify.io.to(`channel:${parent.channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
        ...replyMessage,
        isThreadReply: true,
      });
    }

    return reply.status(201).send(replyMessage);
  });

  // Toggle emoji reaction
  fastify.post('/:messageId/reactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = reactionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Emoji is required' });
    }

    const { emoji } = parseResult.data;

    const existing = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    let action: 'added' | 'removed' = 'added';

    if (existing) {
      await prisma.reaction.delete({
        where: { id: existing.id },
      });
      action = 'removed';
    } else {
      await prisma.reaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
      action = 'added';
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    if (fastify.io && message) {
      fastify.io.to(`channel:${message.channelId}`).emit(SOCKET_EVENTS.MESSAGE_REACTION, {
        messageId,
        userId,
        emoji,
        action,
        reactions: message.reactions,
      });
    }

    return reply.send({ success: true, action, reactions: message?.reactions || [] });
  });
};
