import { prisma } from '@orbit/db';
import { storageDriver } from './storage.js';
import { audit } from './audit.js';
import { INTERNAL_FILE_PREFIX } from './attachments.js';

/**
 * Removes uploads that were never sent. The message composer uploads a file as soon as it is picked, so a file that is
 * removed from the composer, or a message that is abandoned, leaves a stored file and a record with no message behind.
 *
 * Only composer uploads are touched: they name a channel and have no message. Profile and bot pictures, document and
 * ticket images (uploaded without a channel), recordings, and anything used as a profile or bot picture are left alone.
 *
 *   STAGED_UPLOAD_RETENTION_DAYS   how long an unsent upload is kept (default 7, minimum 1)
 */
const BATCH = 200;
const MAX_PER_RUN = 5000;

export async function cleanupStagedUploads(): Promise<{ records: number; files: number }> {
  const days = Math.max(1, parseInt(process.env.STAGED_UPLOAD_RETENTION_DAYS || '', 10) || 7);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let records = 0;
  let files = 0;

  try {
    while (records < MAX_PER_RUN) {
      const stale = await prisma.attachment.findMany({
        where: {
          messageId: null,
          isDeleted: false,
          channelId: { not: null },
          createdAt: { lt: cutoff },
          recording: { is: null },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
        select: { id: true, fileKey: true, fileUrl: true },
      });
      if (stale.length === 0) break;

      const doomed: string[] = [];
      for (const row of stale) {
        const inUseAsPicture = await Promise.all([
          prisma.user.findFirst({ where: { avatarUrl: row.fileUrl }, select: { id: true } }),
          prisma.botApp.findFirst({ where: { avatarUrl: row.fileUrl }, select: { id: true } }),
          prisma.recording.findFirst({ where: { thumbnailUrl: INTERNAL_FILE_PREFIX + row.fileKey }, select: { id: true } }),
        ]);
        if (inUseAsPicture.some(Boolean)) continue;

        // Keep the stored file while any other live record (a reused upload, a forwarded copy) still points at it.
        const otherUse = await prisma.attachment.count({
          where: { fileKey: row.fileKey, isDeleted: false, id: { not: row.id } },
        });
        if (otherUse === 0 && (await storageDriver.deleteFile(row.fileKey))) files += 1;
        doomed.push(row.id);
      }

      if (doomed.length === 0) break; // everything left in this batch is protected; don't loop on it
      await prisma.attachment.deleteMany({ where: { id: { in: doomed } } });
      records += doomed.length;
    }
  } catch (err) {
    console.error('staged upload cleanup failed:', (err as Error).message);
  }

  if (records > 0) {
    // One summary entry per run, not one per file.
    audit(null, { action: 'file.cleanup_unsent', metadata: { records, files, olderThanDays: days } });
  }
  return { records, files };
}
