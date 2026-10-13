import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { getOrCreateSystemBot } from './systemBot.js';

export async function handleMessageMentions({
  workspaceId,
  channelId,
  authorId,
  content,
  messageId,
  isThreadReply = false,
  io,
}: {
  workspaceId: string;
  channelId: string;
  authorId: string;
  content: string;
  messageId: string;
  isThreadReply?: boolean;
  io?: any;
}) {
  try {
    if (!content || !authorId || !workspaceId) return;

    // 1. Extract mention tokens from content: e.g. @username or @firstname
    const mentionRegex = /(?:^|[\s(])@([a-zA-Z0-9_\.\-]+)/g;
    const tokens: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) {
        tokens.push(match[1].toLowerCase());
      }
    }

    if (tokens.length === 0) return;

    // 2. Fetch channel details
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, type: true, workspaceId: true },
    });
    if (!channel) return;

    // 3. Fetch author information
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    const authorName = author?.displayName || author?.username || 'Teammate';

    // 4. Fetch all workspace members to match against mention tokens
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
    });

    // 5. Match users (case-insensitive username or displayName), excluding author
    const matchedUsers = members
      .map((m) => m.user)
      .filter((u) => {
        if (!u || u.id === authorId) return false;
        const uUsername = u.username.toLowerCase();
        const uDisplayName = u.displayName.toLowerCase();
        return (
          tokens.includes(uUsername) ||
          tokens.includes(uDisplayName) ||
          content.toLowerCase().includes(`@${uDisplayName}`) ||
          content.toLowerCase().includes(`@${uUsername}`)
        );
      });

    // Deduplicate target users
    const uniqueTargets = Array.from(new Map(matchedUsers.map((u) => [u.id, u])).values());
    if (uniqueTargets.length === 0) return;

    const locationText = isThreadReply
      ? `in a thread in [#${channel.name}](channel://${channel.id})`
      : `in [#${channel.name}](channel://${channel.id})`;
    const cleanSnippet = content.length > 250 ? `${content.slice(0, 247)}...` : content;

    // 6. Notify each mentioned user
    for (const targetUser of uniqueTargets) {
      // 6a. Create in-app notification record
      const notif = await prisma.notification.create({
        data: {
          userId: targetUser.id,
          workspaceId,
          type: 'MENTION',
          title: `${authorName} mentioned you in #${channel.name}`,
          body: cleanSnippet,
          channelId: channel.id,
          messageId,
        },
      });

      if (io) {
        io.to(`user:${targetUser.id}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notif);
      }

      // 6b. If message was sent outside of a 1:1 DM with this user, send notification to user's DM
      if (channel.type !== 'DIRECT') {
        // Find or create the 1:1 Direct Message channel between author and target user
        let dmChannel = await prisma.channel.findFirst({
          where: {
            workspaceId,
            type: 'DIRECT',
            AND: [
              { members: { some: { userId: authorId } } },
              { members: { some: { userId: targetUser.id } } },
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

        let isNewDm = false;
        if (!dmChannel) {
          dmChannel = await prisma.channel.create({
            data: {
              workspaceId,
              name: `dm-${authorId.slice(0, 4)}-${targetUser.id.slice(0, 4)}`,
              topic: 'Direct message',
              type: 'DIRECT',
              createdById: authorId,
              members: {
                create: [
                  { userId: authorId },
                  { userId: targetUser.id },
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
          isNewDm = true;
        }

        if (isNewDm && io) {
          io.to(`user:${authorId}`).emit(SOCKET_EVENTS.CHANNEL_NEW, dmChannel);
          io.to(`user:${targetUser.id}`).emit(SOCKET_EVENTS.CHANNEL_NEW, dmChannel);
        }

        // Post notification message via Orbit Bot into target user's DM
        const bot = await getOrCreateSystemBot(workspaceId);
        const dmContent = `🤖 **Orbit Bot** • 🔔 **${authorName}** mentioned you ${locationText}:\n> ${cleanSnippet}`;

        const dmMessage = await prisma.message.create({
          data: {
            channelId: dmChannel.id,
            botAppId: bot.id,
            content: dmContent,
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
            reactions: {
              include: {
                user: { select: { id: true, displayName: true } },
              },
            },
            _count: {
              select: { replies: true },
            },
          },
        });

        const dmPayload = {
          ...dmMessage,
          replyCount: dmMessage._count.replies,
          workspaceId,
        };

        if (io) {
          io.to(`channel:${dmChannel.id}`).emit(SOCKET_EVENTS.MESSAGE_NEW, dmPayload);
          io.to(`user:${targetUser.id}`).emit(SOCKET_EVENTS.MESSAGE_NEW, dmPayload);
          io.to(`user:${authorId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, dmPayload);
        }
      }
    }
  } catch (err) {
    console.error('Failed to handle message mentions:', err);
  }
}
