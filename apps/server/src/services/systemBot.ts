import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';

export async function getOrCreateSystemBot(workspaceId: string) {
  let bot = await prisma.botApp.findFirst({
    where: {
      workspaceId,
      name: 'Orbit Bot',
    },
  });

  if (!bot) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    const botToken = `orb_sys_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    bot = await prisma.botApp.create({
      data: {
        workspaceId,
        name: 'Orbit Bot',
        description: 'Default Orbit system notifications and activity alerts',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=OrbitSystemBot&backgroundColor=007a5a',
        botToken,
        scopes: ['chat:write', 'system'],
        isActive: true,
        createdById: ws?.ownerId || 'system',
      },
    });
  }

  return bot;
}

export async function sendSystemNotification({
  workspaceId,
  channelId,
  content,
  io,
}: {
  workspaceId: string;
  channelId: string;
  content: string;
  io?: any;
}) {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { isAnonymous: true },
    });
    if (channel?.isAnonymous) {
      // Do not post bot notifications into anonymous channels to preserve privacy
      return null;
    }

    const bot = await getOrCreateSystemBot(workspaceId);

    const message = await prisma.message.create({
      data: {
        channelId,
        botAppId: bot.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            customStatusText: true,
            customStatusEmoji: true,
          },
        },
        bot: true,
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, displayName: true },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    const payload = {
      ...message,
      replyCount: message._count.replies,
      workspaceId,
    };

    if (io) {
      io.to(`channel:${channelId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
      io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
    }

    return payload;
  } catch (err) {
    console.error('Failed to post system notification message:', err);
    return null;
  }
}

// Default, undeletable channel where workspace events (channel deletions, reactions, ...) are logged.
export const ACTIVITY_CHANNEL = 'activity';
export const ACTIVITY_CHANNEL_TOPIC = 'Workspace activity: channel deletions, reactions and other events';

// Created lazily so workspaces that predate the activity channel get one on their first event.
// ponytail: matched by name and no unique constraint, so two simultaneous first events can create it twice; add a Channel.isSystem flag + unique index if that shows up.
export async function getOrCreateActivityChannel(workspaceId: string, io?: any) {
  const existing = await prisma.channel.findFirst({
    where: { workspaceId, name: ACTIVITY_CHANNEL },
    select: { id: true },
  });
  if (existing) return existing;

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  if (!ws) return null;

  const channel = await prisma.channel.create({
    data: {
      workspaceId,
      name: ACTIVITY_CHANNEL,
      topic: ACTIVITY_CHANNEL_TOPIC,
      type: 'PUBLIC',
      createdById: ws.ownerId,
      members: { create: ws.members.map((m) => ({ userId: m.userId })) },
    },
  });
  io?.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.CHANNEL_NEW, channel);
  return channel;
}

// Never throws: activity logging must not fail the action that triggered it.
export async function postActivity(workspaceId: string, content: string, io?: any) {
  try {
    const channel = await getOrCreateActivityChannel(workspaceId, io);
    if (channel) {
      await sendSystemNotification({ workspaceId, channelId: channel.id, content, io });
    }
  } catch (err) {
    console.error('Failed to post activity message:', err);
  }
}

export async function sendTicketBotNotification({
  workspaceId,
  actorName,
  ticketTitle,
  projectName,
  actionText,
  targetUserIds = [],
  channelId,
  io,
}: {
  workspaceId: string;
  actorName: string;
  ticketTitle: string;
  projectName: string;
  actionText: string;
  targetUserIds?: string[];
  channelId?: string | null;
  io?: any;
}) {
  try {
    const title = `Project: ${projectName}`;
    const body = `${actorName} ${actionText} "${ticketTitle}"`;

    // 1. Create in-app notifications for respective members (e.g. assignee)
    const uniqueUserIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    for (const uId of uniqueUserIds) {
      const notif = await prisma.notification.create({
        data: {
          userId: uId,
          workspaceId,
          type: 'SYSTEM',
          title,
          body,
        },
      });

      if (io) {
        io.to(`user:${uId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notif);
      }
    }

    // 2. Post activity message via Orbit Bot to the project's selected notification channel (or fallback to general)
    let targetChannelId = channelId;
    if (!targetChannelId) {
      const generalChannel = await prisma.channel.findFirst({
        where: {
          workspaceId,
          name: 'general',
        },
        select: { id: true },
      });
      targetChannelId = generalChannel?.id || null;
    }

    if (targetChannelId) {
      const content = `🤖 **Orbit Bot** 📋 *${projectName}* • ${actorName} ${actionText} **"${ticketTitle}"**`;
      await sendSystemNotification({
        workspaceId,
        channelId: targetChannelId,
        content,
        io,
      });
    }
  } catch (err) {
    console.error('Failed to send ticket bot notification:', err);
  }
}
