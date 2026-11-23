import { prisma } from '@orbit/db';
import { matchMentionedUserIds } from './mentionParser.js';

/**
 * Members of `channelId` who want an alert for a new message: never MUTED members, and MENTIONS members only when
 * `content` @mentions them. `excludeUserId` is the author (null for bots). `among` narrows it to those users.
 * Shared by the in-app socket alert and push, so both always agree on who is alerted.
 */
export async function getAlertRecipientIds(
  channelId: string,
  content: string,
  excludeUserId: string | null,
  among?: string[],
): Promise<string[]> {
  const candidates = among?.filter((id) => id !== excludeUserId);
  if (candidates && candidates.length === 0) return [];

  const members = await prisma.channelMember.findMany({
    where: {
      channelId,
      notificationPreference: { not: 'MUTED' },
      ...(candidates
        ? { userId: { in: candidates } }
        : excludeUserId
          ? { userId: { not: excludeUserId } }
          : {}),
    },
    select: {
      notificationPreference: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  const mentioned = new Set(
    matchMentionedUserIds(
      content,
      members.filter((m) => m.notificationPreference === 'MENTIONS').map((m) => m.user),
    ),
  );
  return members
    .filter((m) => m.notificationPreference === 'ALL' || mentioned.has(m.user.id))
    .map((m) => m.user.id);
}

/**
 * Who is alerted about a thread reply: the people "in" the thread (the parent's author and everyone who has replied),
 * limited to current channel members who want the alert (see getAlertRecipientIds), never the reply's own author.
 * Bystanders in the channel are not alerted, like Slack; @mentioned people are alerted separately (mentionService).
 */
export async function getThreadAlertRecipientIds(
  parentMessageId: string,
  channelId: string,
  excludeUserId: string | null,
  content: string,
): Promise<string[]> {
  const thread = await prisma.message.findMany({
    where: { OR: [{ id: parentMessageId }, { parentMessageId }], userId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return getAlertRecipientIds(
    channelId,
    content,
    excludeUserId,
    thread.map((t) => t.userId as string),
  );
}
