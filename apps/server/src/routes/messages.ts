import { getThreadAlertRecipientIds } from '../services/alertRecipients.js';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';
import { quotedMessageInclude, verifyMessageAccess, verifyQuotable, verifyWorkspaceMember } from '../utils/security.js';
import { handleMessageMentions } from '../services/mentionService.js';
import { emitPerViewer, getOrCreateAnonProfile, sanitizeMessageForViewer } from '../services/anonymousService.js';
import { ACTIVITY_CHANNEL, postActivity } from '../services/systemBot.js';

export const MIN_SEARCH_LENGTH = 3;

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

    // Text searches need at least MIN_SEARCH_LENGTH characters ("a" matches nearly every message); a shorter one
    // returns nothing. Filter-only searches (by author / attachments) are unaffected.
    if (queryTerm.length > 0 && queryTerm.length < MIN_SEARCH_LENGTH) {
      return reply.send({ messages: [], total: 0, page: 1, limit: parseInt(limit, 10) || 20, hasMore: false });
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

    // Filtering by author would unmask anonymous posts, so those channels are left out of author-filtered searches.
    if (filterUserId) {
      whereClause.channel = { isAnonymous: false };
    }

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

    // Fetch one extra row to know whether another page exists, and only count the total on the first page
    // (counting every page on every keystroke is what made broad searches expensive).
    const [fetched, total] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limitNum + 1,
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
              isAnonymous: true,
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
      pageNum === 1 ? prisma.message.count({ where: whereClause }) : Promise.resolve(null),
    ]);
    const hasMore = fetched.length > limitNum;
    const messages = fetched.slice(0, limitNum);

    return reply.send({
      // Anonymous channels: hide the real author (and anything else that identifies them) per viewer.
      messages: messages.map((m) => sanitizeMessageForViewer(m, currentUserId, !!m.channel?.isAnonymous)),
      total,
      page: pageNum,
      limit: limitNum,
      hasMore,
    });
  });

  // Get thread replies for a parent message. Paged like the channel's messages: with `limit` (and `cursor` for older
  // pages) it returns the newest `limit` replies, oldest to newest, plus hasMore/nextCursor for the page before them.
  // Without either, it returns every reply (what older app builds expect).
  fastify.get('/:messageId/replies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;
    const { cursor, limit } = request.query as { cursor?: string; limit?: string };
    const paged = cursor !== undefined || limit !== undefined;
    const take = Math.min(Math.max(parseInt(limit ?? '', 10) || 30, 5), 100);

    // Verify tenant and channel access
    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    if (cursor) {
      const inThread = await prisma.message.findFirst({ where: { id: cursor, parentMessageId: messageId }, select: { id: true } });
      if (!inThread) return reply.status(400).send({ error: 'Invalid cursor' });
    }

    const parentMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: quotedMessageInclude,
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        // The total, now that a client only holds the replies it has loaded
        _count: { select: { replies: true } },
      },
    });

    const rawReplies = await prisma.message.findMany({
      where: { parentMessageId: messageId },
      // Paged: newest first (id breaks ties so the cursor is stable); flipped to chronological below
      orderBy: paged ? [{ createdAt: 'desc' }, { id: 'desc' }] : { createdAt: 'asc' },
      ...(paged ? { take: take + 1, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) } : {}),
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: quotedMessageInclude,
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    const hasMore = paged && rawReplies.length > take;
    const chunk = hasMore ? rawReplies.slice(0, take) : rawReplies;
    const nextCursor = hasMore && chunk.length > 0 ? chunk[chunk.length - 1].id : null;
    const replies = paged ? [...chunk].reverse() : chunk;

    const isAnon = access.channel.isAnonymous;
    const sanitizedParent = sanitizeMessageForViewer(
      parentMessage && { ...parentMessage, replyCount: parentMessage._count.replies },
      userId,
      isAnon,
    );
    const sanitizedReplies = replies.map((r) => sanitizeMessageForViewer(r, userId, isAnon));

    return reply.send({
      parent: sanitizedParent,
      replies: sanitizedReplies,
      hasMore,
      nextCursor,
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
    if (quotedMessageId && !(await verifyQuotable(userId, quotedMessageId, parent.channelId, reply))) return;

    let anonName: string | undefined;
    let anonEmoji: string | undefined;
    if (access.channel.isAnonymous) {
      const anonProfile = await getOrCreateAnonProfile(parent.channelId, userId);
      anonName = anonProfile.anonName;
      anonEmoji = anonProfile.anonEmoji;
    }

    const replyMessage = await prisma.message.create({
      data: {
        channelId: parent.channelId,
        parentMessageId: parent.id,
        userId,
        content: content || '',
        quotedMessageId: quotedMessageId || undefined,
        anonName,
        anonEmoji,
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
        quotedMessage: quotedMessageInclude,
        attachments: true,
        reactions: true,
      },
    });

    if (!fullReplyMessage) {
      return reply.status(500).send({ error: 'Failed to retrieve reply message' });
    }

    const selfReply = sanitizeMessageForViewer(fullReplyMessage, userId, access.channel.isAnonymous);
    const publicReply = sanitizeMessageForViewer(fullReplyMessage, 'public', access.channel.isAnonymous);

    // Realtime notification to channel & thread
    if (fastify.io) {
      if (access.channel.isAnonymous) {
        fastify.io.to(`channel:${parent.channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
          ...publicReply,
          isThreadReply: true,
        });
        fastify.io.to(`user:${userId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
          ...selfReply,
          isThreadReply: true,
        });
      } else {
        fastify.io.to(`channel:${parent.channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
          ...fullReplyMessage,
          isThreadReply: true,
        });
      }
    }

    // Alert the people in the thread (the parent's author and earlier repliers) set to notify on everything, plus anyone
    // the reply @mentions (always, even if muted), not the whole channel. Everyone in the channel still gets the
    // message:new above, so reply counts and an open thread stay current silently.
    if (fastify.io) {
      const threadPeople = await getThreadAlertRecipientIds(parent.id, parent.channelId, userId, content || '');
      const alert = access.channel.isAnonymous ? publicReply : fullReplyMessage;
      for (const id of threadPeople) {
        fastify.io.to(`user:${id}`).emit(SOCKET_EVENTS.THREAD_REPLY_NOTIFY, { ...alert, isThreadReply: true });
      }
    }

    // Process mentions in thread reply & trigger DM notifications (skip if anonymous channel)
    if (!access.channel.isAnonymous) {
      handleMessageMentions({
        workspaceId: access.channel.workspaceId,
        channelId: parent.channelId,
        authorId: userId,
        content: content || '',
        messageId: replyMessage.id,
        parentMessageId: parent.id,
        io: fastify.io,
      }).catch((err) => fastify.log.error(err, 'Failed to process thread reply mentions'));
    }

    return reply.status(201).send(selfReply);
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

    const maskReactions = (viewerId: string) =>
      sanitizeMessageForViewer({ ...message, userId: message?.userId }, viewerId, true).reactions;

    if (fastify.io && message) {
      if (access.channel.isAnonymous) {
        // Each viewer gets reactions masked, except their own (so their reaction still shows as theirs).
        await emitPerViewer(fastify.io as any, `channel:${message.channelId}`, SOCKET_EVENTS.MESSAGE_REACTION, (viewerId) => ({
          messageId,
          userId: viewerId === userId ? userId : 'anonymous',
          emoji,
          action,
          reactions: maskReactions(viewerId),
        }));
      } else {
        fastify.io.to(`channel:${message.channelId}`).emit(SOCKET_EVENTS.MESSAGE_REACTION, {
          messageId,
          userId,
          emoji,
          action,
          reactions: message.reactions,
        });
      }
    }

    // Only public, non-anonymous channels: DMs, private and anonymous activity must not leak into #activity.
    const { channel } = access;
    if (action === 'added' && channel.type === 'PUBLIC' && !channel.isAnonymous && channel.name !== ACTIVITY_CHANNEL) {
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } });
      // Not awaited: the reaction response shouldn't wait on the activity post (postActivity never throws).
      void postActivity(
        channel.workspaceId,
        `${emoji} **${actor?.displayName || actor?.username || 'Someone'}** reacted to a message in #${channel.name}`,
        fastify.io,
      );
    }

    return reply.send({
      success: true,
      action,
      reactions: message ? (access.channel.isAnonymous ? maskReactions(userId) : message.reactions) : [],
    });
  });

  // Edit message (Author only)
  fastify.patch('/:messageId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    if (access.message.isDeleted) {
      return reply.status(400).send({ error: 'Cannot edit a deleted message' });
    }

    // Only the author edits a message. Admins (including super admins) can delete one, never rewrite what someone said.
    if (access.message.userId !== userId) {
      return reply.status(403).send({ error: 'You can only edit your own messages' });
    }

    if (access.message.quotedMessageId) {
      const quoted = await prisma.message.findUnique({ where: { id: access.message.quotedMessageId }, select: { channelId: true } });
      if (quoted && quoted.channelId !== access.message.channelId) {
        return reply.status(400).send({ error: 'Forwarded messages cannot be edited' });
      }
    }

    const parseResult = editMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: parseResult.data.content,
        isEdited: true,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: quotedMessageInclude,
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

    const isAnon = access.channel.isAnonymous;
    const sanitizedUpdated = sanitizeMessageForViewer(updated, userId, isAnon);
    const publicUpdated = sanitizeMessageForViewer(updated, 'public', isAnon);

    if (fastify.io) {
      if (isAnon) {
        fastify.io.to(`channel:${updated.channelId}`).emit('message:updated', publicUpdated);
        fastify.io.to(`user:${userId}`).emit('message:updated', sanitizedUpdated);
      } else {
        fastify.io.to(`channel:${updated.channelId}`).emit('message:updated', updated);
      }
    }

    return reply.send(sanitizedUpdated);
  });

  // Delete message (Author, Workspace Admin/Owner, or Super Admin)
  fastify.delete('/:messageId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyMessageAccess(userId, messageId, reply);
    if (!access) return;

    if (access.message.isDeleted) {
      return reply.status(400).send({ error: 'Message is already deleted' });
    }

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

    // When an admin deletes someone else's message, record who, so the placeholder can say "deleted by <name>"
    let deletedBy: { deletedById: string; deletedByName: string } | null = null;
    if (!isAuthor) {
      const admin = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } });
      deletedBy = { deletedById: userId, deletedByName: admin?.displayName || admin?.username || 'an admin' };
    }

    // Soft delete: set isDeleted to true, clear content, and unpin
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: '',
        isPinned: false,
        ...(deletedBy ?? {}),
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
        },
        quotedMessage: quotedMessageInclude,
        attachments: true,
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

    // Also mark attachments as deleted
    await prisma.attachment.updateMany({
      where: { messageId },
      data: { isDeleted: true },
    });

    const isAnon = access.channel.isAnonymous;
    const sanitizedUpdated = sanitizeMessageForViewer(updated, userId, isAnon);
    const publicUpdated = sanitizeMessageForViewer(updated, 'public', isAnon);

    if (fastify.io) {
      const payload = isAnon ? publicUpdated : updated;
      fastify.io.to(`channel:${access.message.channelId}`).emit('message:deleted', {
        messageId,
        channelId: access.message.channelId,
        message: payload,
      });
      fastify.io.to(`channel:${access.message.channelId}`).emit('message:updated', payload);
    }

    return reply.send({ success: true, messageId, message: sanitizedUpdated });
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
        quotedMessage: quotedMessageInclude,
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

    const isAnonPin = access.channel.isAnonymous;
    if (fastify.io) {
      if (isAnonPin) {
        // Per viewer, so the author still sees their own message as theirs; the pinner isn't revealed.
        const room = `channel:${updated.channelId}`;
        await emitPerViewer(fastify.io as any, room, 'message:updated', (v) => sanitizeMessageForViewer(updated, v, true));
        await emitPerViewer(fastify.io as any, room, 'message:pinned', (v) => ({
          messageId: updated.id,
          channelId: updated.channelId,
          isPinned: updated.isPinned,
          message: sanitizeMessageForViewer(updated, v, true),
        }));
      } else {
        fastify.io.to(`channel:${updated.channelId}`).emit('message:updated', updated);
        fastify.io.to(`channel:${updated.channelId}`).emit('message:pinned', {
          messageId: updated.id,
          channelId: updated.channelId,
          isPinned: updated.isPinned,
          pinnedBy: userId,
          message: updated,
        });
      }
    }

    return reply.send({ success: true, message: sanitizeMessageForViewer(updated, userId, isAnonPin) });
  });
};
