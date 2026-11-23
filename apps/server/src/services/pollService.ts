import { prisma, Prisma } from '@orbit/db';
import { POLL_LIMITS, type MessagePoll } from '@orbit/types';
import { z } from 'zod';

const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} can't be empty`).max(max, `${label} must be ${max} characters or fewer`);

export const pollInputSchema = z
  .object({
    question: text(POLL_LIMITS.questionLength, 'Question'),
    options: z
      .array(text(POLL_LIMITS.optionLength, 'Option'))
      .min(POLL_LIMITS.minOptions, `A poll needs at least ${POLL_LIMITS.minOptions} options`)
      .max(POLL_LIMITS.maxOptions, `A poll can have at most ${POLL_LIMITS.maxOptions} options`),
    allowMultiple: z.boolean().optional().default(false),
  })
  .refine((p) => new Set(p.options.map((o) => o.toLowerCase())).size === p.options.length, {
    message: 'Poll options must be different from each other',
  });

export type PollInput = z.infer<typeof pollInputSchema>;

/** Readable stand-in stored as the message content: what search, push, previews and clients without poll support show. */
export function pollFallbackContent(poll: PollInput): string {
  return [`📊 Poll: ${poll.question}`, ...poll.options.map((o) => `• ${o}`)].join('\n');
}

/** Nested create for a message's poll. */
export function pollCreateData(poll: PollInput) {
  return {
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    options: { create: poll.options.map((text, position) => ({ text, position })) },
  };
}

/**
 * What a message query includes to show its poll. Votes carry voter ids only for counting and the viewer's own choice;
 * they leave the server through toPollView, never raw.
 */
export const pollInclude = {
  include: {
    options: {
      orderBy: { position: 'asc' },
      include: {
        votes: {
          orderBy: { createdAt: 'asc' },
          select: { userId: true, user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    },
  },
} satisfies Prisma.PollDefaultArgs;

type RawPoll = Prisma.PollGetPayload<typeof pollInclude>;

/** A poll straight from a query with pollInclude (as opposed to one already turned into a view). */
export function isRawPoll(poll: unknown): poll is RawPoll {
  const options = (poll as RawPoll | null)?.options;
  return Array.isArray(options) && options.every((o) => Array.isArray(o?.votes));
}

/**
 * The poll as `viewerId` may see it. Anonymous channels get counts only: no voter, not even the order people voted in,
 * ever leaves the server. `viewerId` null (or 'public') is a broadcast to everyone, so it carries no "my votes".
 */
export function toPollView(poll: RawPoll, viewerId: string | null, isAnonymous: boolean): MessagePoll {
  const voters = new Set<string>();
  const myVotes: string[] = [];
  const options = poll.options.map((option) => {
    for (const vote of option.votes) {
      voters.add(vote.userId);
      if (vote.userId === viewerId) myVotes.push(option.id);
    }
    return {
      id: option.id,
      text: option.text,
      voteCount: option.votes.length,
      ...(isAnonymous
        ? {}
        : { voters: option.votes.map(({ user }) => ({ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl })) }),
    };
  });
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    options,
    voterCount: voters.size,
    ...(viewerId && viewerId !== 'public' ? { myVotes } : {}),
  };
}

export class PollVoteError extends Error {}

/**
 * Replaces `userId`'s votes on the poll with `optionIds` (empty = take the vote back) and returns the updated poll.
 * Votes on one poll are serialized with a row lock, so two quick clicks can never leave two answers on a
 * single-answer poll.
 */
export async function castPollVote(messageId: string, userId: string, optionIds: string[]): Promise<RawPoll> {
  const chosen = [...new Set(optionIds)];
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; allowMultiple: boolean }[]>`
      SELECT id, "allowMultiple" FROM "Poll" WHERE "messageId" = ${messageId} FOR UPDATE`;
    const poll = locked[0];
    if (!poll) throw new PollVoteError('This message has no poll');
    if (!poll.allowMultiple && chosen.length > 1) throw new PollVoteError('This poll allows only one answer');

    const valid = await tx.pollOption.count({ where: { pollId: poll.id, id: { in: chosen } } });
    if (valid !== chosen.length) throw new PollVoteError('Unknown poll option');

    await tx.pollVote.deleteMany({ where: { pollId: poll.id, userId } });
    if (chosen.length) {
      await tx.pollVote.createMany({ data: chosen.map((optionId) => ({ pollId: poll.id, optionId, userId })) });
    }
    return tx.poll.findUniqueOrThrow({ where: { id: poll.id }, ...pollInclude });
  });
}
