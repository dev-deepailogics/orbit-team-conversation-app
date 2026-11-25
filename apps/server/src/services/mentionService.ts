import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { getOrCreateSystemBot } from './systemBot.js';
import { extractMentionTokens, matchMentionedUserIds, mentionsChannel } from './mentionParser.js';
import { withPushOverride } from './pushService.js';

export async function handleMessageMentions({
  workspaceId,
  channelId,
  authorId,
  content,
  messageId,
  parentMessageId,
  io,
}: {
  workspaceId: string;
  channelId: string;
  authorId: string;
  content: string;
  messageId: string;
  /** Set when the mention is a thread reply: the thread's parent message. */
  parentMessageId?: string;
  io?: any;
}) {
  try {
    if (!content || !authorId || !workspaceId) return;
    // Bail out before the member lookup below if there's no "@" at all.
    if (extractMentionTokens(content).length === 0) return;

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
    const candidates = members.map((m) => m.user).filter((u): u is NonNullable<typeof u> => !!u);
    const mentionedIds = new Set(matchMentionedUserIds(content, candidates, authorId));
    const uniqueTargets = candidates.filter((u) => mentionedIds.has(u.id));
    const cleanSnippet = content.length > 250 ? `${content.slice(0, 247)}...` : content;

    // 5b. @channel: one in-app notification per channel member, even if muted (not the author, not anyone personally
    // mentioned — they get the fuller notice below). No bot DM per member: that would flood everyone's DMs.
    if (mentionsChannel(content)) {
      const channelMembers = await prisma.channelMember.findMany({
        where: { channelId, userId: { notIn: [authorId, ...mentionedIds] } },
        select: { userId: true },
      });
      if (channelMembers.length > 0) {
        const notifs = await prisma.notification.createManyAndReturn({
          data: channelMembers.map((m) => ({
            userId: m.userId,
            workspaceId,
            type: 'MENTION' as const,
            title: `${authorName} mentioned @channel in #${channel.name}`,
            body: cleanSnippet,
            channelId: channel.id,
            messageId,
          })),
        });
        for (const n of notifs) io?.to(`user:${n.userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, n);
      }
    }

    if (uniqueTargets.length === 0) return;

    const locationText = parentMessageId
      ? `in a thread in [#${channel.name}](channel://${channel.id})`
      : `in [#${channel.name}](channel://${channel.id})`;
    // In-app link the web app opens at that exact message (and its thread): message://<channel>/<message>[/<parent>]
    const messageLink = `message://${channel.id}/${messageId}${parentMessageId ? `/${parentMessageId}` : ''}`;

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
        const dmContent = `🤖 **Orbit Bot** • 🔔 **${authorName}** mentioned you ${locationText}:\n> ${cleanSnippet}\n\n[Jump to message →](${messageLink})`;

        // The note is for the mentioned person only: its push goes to them (not the author, who shares this DM) and a
        // tap opens the message they were mentioned in.
        const targetId = targetUser.id;
        const dmMessage = await withPushOverride(
          { userIds: [targetId], open: { channelId: channel.id, parentMessageId } },
          () =>
            prisma.message.create({
              data: { channelId: dmChannel.id, botAppId: bot.id, content: dmContent },
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
                bot: true,
                attachments: true,
                reactions: { include: { user: { select: { id: true, displayName: true } } } },
                _count: { select: { replies: true } },
              },
            }),
        );

        // The author never sees the note arrive, so it mustn't come back as unread for them on their next load. Only
        // when they had nothing unread in this DM already: moving lastReadAt would otherwise hide real unread messages.
        // Mirrors the unread count query in routes/channels.ts.
        await prisma.$executeRaw`
          UPDATE "ChannelMember" cm SET "lastReadAt" = ${dmMessage.createdAt}
          WHERE cm."channelId" = ${dmChannel.id} AND cm."userId" = ${authorId}
            AND NOT EXISTS (
              SELECT 1 FROM "Message" m
              WHERE m."channelId" = cm."channelId" AND m."parentMessageId" IS NULL AND m."isDeleted" = false
                AND m."userId" IS DISTINCT FROM ${authorId} AND m."createdAt" > cm."lastReadAt" AND m.id <> ${dmMessage.id}
            )`;

        // Only the mentioned person is told live; the author's open DM picks the note up on its next load.
        io?.to(`user:${targetId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, {
          ...dmMessage,
          replyCount: dmMessage._count.replies,
          workspaceId,
        });
      }
    }
  } catch (err) {
    console.error('Failed to handle message mentions:', err);
  }
}
