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
