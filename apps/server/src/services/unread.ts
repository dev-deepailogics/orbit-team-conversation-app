import { Prisma } from '@orbit/db';

/**
 * SQL condition for a message `m` that counts as unread for `userId`, whose membership row is `cm`: a message from
 * someone else since they last read the conversation. Thread replies count too, for the people the reply alerts
 * (see getThreadAlertRecipientIds): set to ALL and in the thread (wrote the parent or replied), or anyone in a DM.
 * Shared by the unread counts and anything that must agree with them.
 */
export const unreadMessageSql = (userId: string) => Prisma.sql`
  m."isDeleted" = false AND m."userId" IS DISTINCT FROM ${userId} AND m."createdAt" > cm."lastReadAt"
  AND (
    m."parentMessageId" IS NULL
    OR (cm."notificationPreference" = 'ALL' AND (
      EXISTS (SELECT 1 FROM "Channel" c WHERE c.id = m."channelId" AND c.type = 'DIRECT')
      OR EXISTS (
        SELECT 1 FROM "Message" t
        WHERE t."userId" = ${userId} AND (t.id = m."parentMessageId" OR t."parentMessageId" = m."parentMessageId")
      )
    ))
  )`;
