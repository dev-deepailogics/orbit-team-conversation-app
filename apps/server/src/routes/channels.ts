import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';
import { sendSystemNotification } from '../services/systemBot.js';
import { handleMessageMentions } from '../services/mentionService.js';
import { verifyChannelAccess } from '../utils/security.js';

const createChannelSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  topic: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['PUBLIC', 'PRIVATE', 'DIRECT', 'GROUP_DIRECT']).default('PUBLIC'),
});

const postMessageSchema = z.object({
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
  message: 'Message must contain text content or at least one attachment',
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
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
            },
          },
        },
      },
    });

    if (fastify.io) {
      if (type === 'PUBLIC') {
        fastify.io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.CHANNEL_NEW, channel);
      } else {
        fastify.io.to(`user:${userId}`).emit(SOCKET_EVENTS.CHANNEL_NEW, channel);
      }
    }

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

    // Verify current user belongs to workspace
    const currentMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
    });
    if (!currentMember) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    // Verify target user belongs to workspace
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!targetMember) {
      return reply.status(403).send({ error: 'Target user is not a member of this workspace' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Handle self-DM (chat with yourself) vs peer-DM
    if (currentUserId === targetUserId) {
      const existingSelfDm = await prisma.channel.findFirst({
        where: {
          workspaceId,
          type: 'DIRECT',
          createdById: currentUserId,
          members: {
            none: {
              userId: { not: currentUserId },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
              },
            },
          },
        },
      });

      if (existingSelfDm) {
        return reply.send(existingSelfDm);
      }

      const selfDmChannel = await prisma.channel.create({
        data: {
          workspaceId,
          name: `dm-${currentUserId.slice(0, 8)}`,
          topic: `Self Note`,
          type: 'DIRECT',
          createdById: currentUserId,
          members: {
            create: [{ userId: currentUserId }],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
              },
            },
          },
        },
      });

      return reply.status(201).send(selfDmChannel);
    }

    // Peer-to-peer 1:1 DM between two different users
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
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
            },
          },
        },
      },
    });

    if (existingDm) {
      return reply.send(existingDm);
    }

    // Create new 1:1 DM channel
    const dmChannel = await prisma.channel.create({
      data: {
        workspaceId,
        name: `dm-${currentUserId.slice(0, 4)}-${targetUserId.slice(0, 4)}`,
        topic: `Direct message`,
        type: 'DIRECT',
        createdById: currentUserId,
        members: {
          create: [
            { userId: currentUserId },
            { userId: targetUserId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
            },
          },
        },
      },
    });

    return reply.status(201).send(dmChannel);
  });

  // Get complete details for a channel
  fastify.get('/:channelId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
                systemRole: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            attachments: true,
          },
        },
      },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    const creator = await prisma.user.findUnique({
      where: { id: channel.createdById },
      select: { id: true, username: true, displayName: true, email: true },
    });

    return reply.send({
      ...channel,
      creator,
    });
  });

  // Get pinned messages for a channel
  fastify.get('/:channelId/pins', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const pinnedMessages = await prisma.message.findMany({
      where: {
        channelId,
        isPinned: true,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
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

    return reply.send(pinnedMessages);
  });

  // Get messages for a channel (Cursor-based Chunked Pagination)
  fastify.get('/:channelId/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;
    const { cursor, limit = '30' } = request.query as { cursor?: string; limit?: string };
    const take = Math.min(Math.max(parseInt(limit, 10) || 30, 5), 100);

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    // Fetch take + 1 to detect if older messages exist
    const rawMessages = await prisma.message.findMany({
      where: {
        channelId,
        parentMessageId: null, // Root channel messages only
      },
      take: take + 1,
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
        quotedMessage: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
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

    const hasMore = rawMessages.length > take;
    const chunk = hasMore ? rawMessages.slice(0, take) : rawMessages;
    const nextCursor = hasMore && chunk.length > 0 ? chunk[chunk.length - 1].id : null;

    // Format response and reverse to chronological order (oldest to newest)
    const formatted = chunk.map((m) => ({
      ...m,
      replyCount: m._count.replies,
    })).reverse();

    return reply.send({
      messages: formatted,
      hasMore,
      nextCursor,
    });
  });

  // Add Members to Channel
  fastify.post('/:channelId/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const { userIds } = request.body as { userIds: string[] };
    const currentUserId = (request.user as { id: string }).id;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return reply.status(400).send({ error: 'userIds array is required' });
    }

    const access = await verifyChannelAccess(currentUserId, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    // Verify all candidate userIds are members of this workspace
    const validMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: channel.workspaceId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const validUserIds = validMembers.map((m) => m.userId);
    if (validUserIds.length === 0) {
      return reply.status(400).send({ error: 'Selected users must belong to this workspace' });
    }

    // Add each verified user to channel
    for (const userId of validUserIds) {
      await prisma.channelMember.upsert({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
        create: {
          channelId,
          userId,
        },
        update: {},
      });
    }

    const updatedChannel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
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
          },
        },
      },
    });

    if (fastify.io && updatedChannel) {
      for (const uId of userIds) {
        fastify.io.to(`user:${uId}`).emit(SOCKET_EVENTS.CHANNEL_NEW, updatedChannel);
      }
      fastify.io.to(`channel:${channelId}`).emit('channel:updated', updatedChannel);

      // Post system notification from default Orbit Bot
      try {
        const inviter = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { displayName: true, username: true },
        });
        const addedUsers = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { displayName: true, username: true },
        });
        const inviterName = inviter?.displayName || inviter?.username || 'Someone';
        const addedNames = addedUsers.map((u) => u.displayName || u.username).join(', ');
        await sendSystemNotification({
          workspaceId: channel.workspaceId,
          channelId,
          content: `🎉 **${inviterName}** added **${addedNames}** to #${channel.name}.`,
          io: fastify.io,
        });
      } catch (botErr) {
        fastify.log.error(botErr, 'Failed to send channel member addition notification');
      }
    }

    return reply.send(updatedChannel);
  });

  // Send message in channel
  fastify.post('/:channelId/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const parseResult = postMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { content, attachments, quotedMessageId } = parseResult.data;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    const message = await prisma.message.create({
      data: {
        channelId,
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
              messageId: message.id,
              channelId: channel.id,
            },
          });
        } else {
          await prisma.attachment.create({
            data: {
              workspaceId: channel.workspaceId,
              channelId: channel.id,
              messageId: message.id,
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

    const fullMessage = await prisma.message.findUnique({
      where: { id: message.id },
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
        quotedMessage: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
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

    if (!fullMessage) {
      return reply.status(500).send({ error: 'Failed to retrieve created message' });
    }

    const payload = {
      ...fullMessage,
      replyCount: 0,
      workspaceId: channel.workspaceId,
    };

    // Scoped realtime broadcast via Socket.IO
    if (fastify.io) {
      if (channel.type === 'PUBLIC') {
        fastify.io.to(`workspace:${channel.workspaceId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
      } else {
        // Emit only to members of this private / direct channel
        for (const m of channel.members) {
          fastify.io.to(`user:${m.userId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
        }
        fastify.io.to(`channel:${channel.id}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
      }
    }

    // Process mentions & trigger DM notifications
    handleMessageMentions({
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      authorId: userId,
      content: content || '',
      messageId: message.id,
      isThreadReply: false,
      io: fastify.io,
    }).catch((err) => fastify.log.error(err, 'Failed to process message mentions'));

    return reply.status(201).send(payload);
  });

  // Get Whiteboard Data for Channel/DM
  fastify.get('/:channelId/whiteboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    return reply.send({
      channelId: channel.id,
      whiteboardData: channel.whiteboardData || { elements: [] },
    });
  });

  // Save Whiteboard Data for Channel/DM
  fastify.put('/:channelId/whiteboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;
    const { whiteboardData } = request.body as { whiteboardData: any };

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        whiteboardData: whiteboardData || {},
      },
    });

    // Realtime broadcast to active viewers in channel
    if (fastify.io) {
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, {
        channelId,
        data: whiteboardData,
        userId,
      });
    }

    return reply.send({
      success: true,
      whiteboardData: updated.whiteboardData,
    });
  });

  // Clear Whiteboard Data
  fastify.delete('/:channelId/whiteboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        whiteboardData: { elements: [] },
      },
    });

    if (fastify.io) {
      fastify.io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, {
        channelId,
        userId,
      });

      // Post system notification from default Orbit Bot
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, username: true },
        });
        const userName = user?.displayName || user?.username || 'Someone';
        await sendSystemNotification({
          workspaceId: channel.workspaceId,
          channelId,
          content: `🧹 **${userName}** cleared the whiteboard canvas.`,
          io: fastify.io,
        });
      } catch (botErr) {
        fastify.log.error(botErr, 'Failed to send whiteboard clear notification');
      }
    }

    return reply.send({ success: true });
  });

  // Update Channel topic & description
  fastify.patch('/:channelId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

    const updateSchema = z.object({
      topic: z.string().max(250).optional(),
      description: z.string().max(500).optional(),
    });

    const parseResult = updateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: parseResult.data,
    });

    if (fastify.io) {
      fastify.io.to(`channel:${channelId}`).emit('channel:updated', updated);
      fastify.io.to(`workspace:${updated.workspaceId}`).emit('channel:updated', updated);
    }

    return reply.send(updated);
  });

  // Delete Channel
  fastify.delete('/:channelId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;
    const channel = access.channel;

    if (channel.name === 'general') {
      return reply.status(400).send({ error: 'The default general channel cannot be deleted' });
    }

    const wsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
    });

    const canDelete =
      access.isSuperAdmin ||
      channel.createdById === userId ||
      wsMember?.role === 'OWNER' ||
      wsMember?.role === 'ADMIN';

    if (!canDelete) {
      return reply.status(403).send({ error: 'You do not have permission to delete this channel' });
    }

    await prisma.channel.delete({
      where: { id: channelId },
    });

    if (fastify.io) {
      fastify.io.to(`workspace:${channel.workspaceId}`).emit('channel:deleted', { channelId });
    }

    return reply.send({ success: true, channelId });
  });
};
