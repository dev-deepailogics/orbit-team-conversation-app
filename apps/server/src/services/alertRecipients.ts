import { prisma } from '@orbit/db';
import { extractMentionTokens, matchMentionedUserIds, mentionsChannel } from './mentionParser.js';

/**
 * Members of `channelId` who are alerted about a new message:
 *  - anyone the message @mentions, always, even if they muted the channel or are outside `among`;
 *  - on `@channel`, every member, even those who muted the channel;
 *  - otherwise members set to ALL, limited to `among` when given (e.g. the people in a thread).
 * MENTIONS and MUTED members are therefore only alerted when mentioned. `excludeUserId` is the author (null for bots).
 * Shared by the in-app socket alert and push, so both always agree on who is alerted.
 */
export async function getAlertRecipientIds(
  channelId: string,
  content: string,
  excludeUserId: string | null,
  among?: string[],
): Promise<string[]> {
  const scope = among?.filter((id) => id !== excludeUserId);
  const hasMentions = extractMentionTokens(content).length > 0;
  if (scope?.length === 0 && !hasMentions) return [];

  // A mention can reach any member, so it needs the whole channel; otherwise only the in-scope ALL members can match.
  const notAuthor = excludeUserId ? { userId: { not: excludeUserId } } : {};
  const members = await prisma.channelMember.findMany({
    where: hasMentions
      ? { channelId, ...notAuthor }
      : { channelId, notificationPreference: 'ALL', ...(scope ? { userId: { in: scope } } : notAuthor) },
    select: {
      notificationPreference: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  });
  if (!hasMentions) return members.map((m) => m.user.id);

  const mentioned = new Set(matchMentionedUserIds(content, members.map((m) => m.user)));
  const channelWide = mentionsChannel(content);
  const inScope = scope ? new Set(scope) : null;
  return members
    .filter(
      (m) =>
        channelWide ||
        mentioned.has(m.user.id) ||
        (m.notificationPreference === 'ALL' && (!inScope || inScope.has(m.user.id))),
    )
    .map((m) => m.user.id);
}

/**
 * Who is alerted about a thread reply: the people "in" the thread (the parent's author and everyone who has replied)
 * who are still in the channel and set to ALL, plus any channel member the reply @mentions (see getAlertRecipientIds).
 * Never the reply's own author. Other members of the channel are not alerted, like Slack. In a DM everyone in it is
 * part of every thread (there is no one else it could be for), so all its members set to ALL are alerted.
 */
export async function getThreadAlertRecipientIds(
  parentMessageId: string,
  channelId: string,
  excludeUserId: string | null,
  content: string,
): Promise<string[]> {
  const [channel, thread] = await Promise.all([
    prisma.channel.findUnique({ where: { id: channelId }, select: { type: true } }),
    prisma.message.findMany({
      where: { OR: [{ id: parentMessageId }, { parentMessageId }], userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);
  if (channel?.type === 'DIRECT') return getAlertRecipientIds(channelId, content, excludeUserId);
  return getAlertRecipientIds(
    channelId,
    content,
    excludeUserId,
    thread.map((t) => t.userId as string),
  );
}
