import { prisma } from '@orbit/db';

/**
 * The people who are "in" a thread: the author of the parent message and everyone who has replied in it, limited to
 * current members of the channel and excluding `excludeUserId` (the author of the new reply). Used to decide who gets
 * alerted about a new reply, instead of every member of the channel. Mentioned people are alerted separately (mentionService).
 */
export async function getThreadParticipantIds(
  parentMessageId: string,
  channelId: string,
  excludeUserId: string | null,
): Promise<string[]> {
  const thread = await prisma.message.findMany({
    where: { OR: [{ id: parentMessageId }, { parentMessageId }], userId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const ids = thread.map((t) => t.userId as string).filter((id) => id !== excludeUserId);
  if (ids.length === 0) return [];
  const members = await prisma.channelMember.findMany({
    where: { channelId, userId: { in: ids } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}
