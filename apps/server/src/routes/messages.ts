import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';
import { verifyMessageAccess, verifyWorkspaceMember } from '../utils/security.js';

const searchQuerySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  q: z.string().optional().default(''),
  channelId: z.string().optional(),
  userId: z.string().optional(),
  hasAttachment: z.enum(['true', 'false']).optional(),
  limit: z.string().optional().default('20'),
  page: z.string().optional().default('1'),
});

const threadReplySchema = z.object({
  content: z.string().optional().default(''),
  quotedMessageId: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string().optional(),
    fileUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
    fileKey: z.string().optional(),
    storageProvider: z.string().optional(),
  })).optional(),
}).refine((data) => (data.content && data.content.trim().length > 0) || (data.attachments && data.attachments.length > 0), {
  message: 'Reply must contain text or at least one attachment',
});

const reactionSchema = z.object({
  emoji: z.string().min(1),
});

const editMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty'),
});

export const messageRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Search messages within a workspace (multi-tenant & channel-access protected)
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const currentUserId = (request.user as { id: string }).id;
    const parseResult = searchQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { workspaceId, q, channelId, userId: filterUserId, hasAttachment, limit, page } = parseResult.data;
    const queryTerm = q.trim();

    // Verify workspace membership (or SUPER_ADMIN)
    const membership = await verifyWorkspaceMember(currentUserId, workspaceId, reply);
    if (!membership) return;
    const isSuperAdmin = membership.isSuperAdmin;

    // Resolve accessible channels for current user in this workspace
    const accessibleChannels = await prisma.channel.findMany({
      where: {
        workspaceId,
        isArchived: false,
        ...(isSuperAdmin
          ? {}
          : {
              OR: [
                { type: 'PUBLIC' },
                { members: { some: { userId: currentUserId } } },
              ],
            }),
        ...(channelId ? { id: channelId } : {}),
      },
      select: { id: true },
    });

    const accessibleChannelIds = accessibleChannels.map((c) => c.id);
    if (accessibleChannelIds.length === 0) {
      return reply.send({
        messages: [],
        total: 0,
        page: 1,
        limit: parseInt(limit, 10) || 20,
      });
    }

    // If query is empty and no specific filters are applied, return empty
    if (!queryTerm && !filterUserId && hasAttachment !== 'true') {
      return reply.send({
        messages: [],
        total: 0,
        page: 1,
        limit: parseInt(limit, 10) || 20,
      });
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offsetNum = (pageNum - 1) * limitNum;

    const whereClause: any = {
      channelId: { in: accessibleChannelIds },
      isDeleted: false,
    };

    if (queryTerm) {
      whereClause.content = {
        contains: queryTerm,
        mode: 'insensitive',
      };
    }

    if (filterUserId) {
      whereClause.userId = filterUserId;
    }

    if (hasAttachment === 'true') {
      whereClause.attachments = {
        some: { isDeleted: false },
      };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum,
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
          bot: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
              topic: true,
            },
          },
          attachments: {
            where: { isDeleted: false },
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileType: true,
              fileSize: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true },
              },
            },
          },
          _count: {
            select: { replies: true },
          },
        },
      }),
      prisma.message.count({ where: whereClause }),
    ]);

    return reply.send({
      messages,
      total,
      page: pageNum,
      limit: limitNum,
    });
  });

  // Get thread replies for a parent message
  fastify.get('/:messageId/replies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    // Verify tenant and channel access
    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    const parentMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    const replies = await prisma.message.findMany({
      where: { parentMessageId: messageId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
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

    // Verify tenant and channel access
    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;
    const parent = access.message;

    const parseResult = threadReplySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { content, attachments, quotedMessageId } = parseResult.data;

    const replyMessage = await prisma.message.create({
      data: {
        channelId: parent.channelId,
        parentMessageId: parent.id,
        userId,
        content: content || '',
        quotedMessageId: quotedMessageId || undefined,
      },
    });

    // Link or create attachments
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.id) {
          await prisma.attachment.update({
            where: { id: att.id },
            data: {
              messageId: replyMessage.id,
              channelId: parent.channelId,
            },
          });
        } else {
          await prisma.attachment.create({
            data: {
              workspaceId: access.channel.workspaceId,
              channelId: parent.channelId,
              messageId: replyMessage.id,
              uploaderId: userId,
              fileName: att.fileName || 'attachment',
              fileKey: att.fileKey || att.fileUrl,
              fileUrl: att.fileUrl,
              fileType: att.fileType || 'application/octet-stream',
              fileSize: att.fileSize || 0,
              storageProvider: att.storageProvider || 'LOCAL',
            },
          });
        }
      }
    }

    const fullReplyMessage = await prisma.message.findUnique({
      where: { id: replyMessage.id },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    if (!fullReplyMessage) {
      return reply.status(500).send({ error: 'Failed to retrieve reply message' });
    }

    // Realtime notification to channel & thread
    if (fastify.io) {
      fastify.io.to(`channel:${parent.channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
        ...fullReplyMessage,
        isThreadReply: true,
      });
    }

    return reply.status(201).send(fullReplyMessage);
  });

  // Toggle emoji reaction
  fastify.post('/:messageId/reactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    // Verify tenant and channel access
    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

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

  // Edit message (Author only)
  fastify.patch('/:messageId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    if (access.message.userId !== userId && !access.isSuperAdmin) {
      return reply.status(403).send({ error: 'You can only edit your own messages' });
    }

    const parseResult = editMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: parseResult.data.content,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    if (fastify.io) {
      fastify.io.to(`channel:${updated.channelId}`).emit('message:updated', updated);
    }

    return reply.send(updated);
  });

  // Delete message (Author, Workspace Admin/Owner, or Super Admin)
  fastify.delete('/:messageId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: access.channel.workspaceId,
          userId,
        },
      },
    });

    const isAuthor = access.message.userId === userId;
    const isWsAdmin = wsMember?.role === 'OWNER' || wsMember?.role === 'ADMIN';

    if (!isAuthor && !isWsAdmin && !access.isSuperAdmin) {
      return reply.status(403).send({ error: 'You do not have permission to delete this message' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    if (fastify.io) {
      fastify.io.to(`channel:${access.message.channelId}`).emit('message:deleted', {
        messageId,
        channelId: access.message.channelId,
      });
    }

    return reply.send({ success: true, messageId });
  });

  // Pin or unpin a message
  fastify.post('/:messageId/pin', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    const body = request.body as { isPinned?: boolean } | undefined;
    const newPinnedState =
      typeof body?.isPinned === 'boolean' ? body.isPinned : !access.message.isPinned;

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: newPinnedState,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        bot: {
          select: { id: true, name: true, avatarUrl: true },
        },
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        attachments: {
          where: { isDeleted: false },
        },
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    if (fastify.io) {
      fastify.io.to(`channel:${updated.channelId}`).emit('message:updated', updated);
      fastify.io.to(`channel:${updated.channelId}`).emit('message:pinned', {
        messageId: updated.id,
        channelId: updated.channelId,
        isPinned: updated.isPinned,
        pinnedBy: userId,
        message: updated,
      });
    }

    return reply.send({ success: true, message: updated });
  });
};
