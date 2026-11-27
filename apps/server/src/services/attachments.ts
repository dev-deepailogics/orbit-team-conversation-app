import { prisma } from '@orbit/db';

/** Where stored files are served from. A file's URL is always this prefix plus its storage key. */
export const INTERNAL_FILE_PREFIX = '/api/files/download/';

export interface AttachmentInput {
  id?: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileKey?: string;
  storageProvider?: string;
}

export type PreparedAttachment =
  /** An upload the caller made earlier and has not attached to a message yet: link it. */
  | { kind: 'link'; id: string }
  /** A new record for a file the caller uploaded (a copy, e.g. the same file sent twice) or an external link. */
  | { kind: 'create'; data: { fileName: string; fileKey: string; fileUrl: string; fileType: string; fileSize: number; storageProvider: string } };

export type PrepareResult = { ok: true; items: PreparedAttachment[] } | { ok: false; error: string };

/**
 * Checks attachments a client wants on a new message BEFORE the message is created. A file stored by Orbit can only be
 * attached by the person who uploaded it (to this workspace): knowing another file's id or storage path is not enough,
 * so a leaked link can never be turned into access, ownership or the right to delete someone else's file. Anything else
 * must be an external http(s) link, which is just a link.
 */
export async function prepareAttachments(userId: string, workspaceId: string, inputs: AttachmentInput[] | undefined): Promise<PrepareResult> {
  const items: PreparedAttachment[] = [];

  for (const att of inputs ?? []) {
    if (att.id) {
      // Attach an existing record: it must be this user's own upload in this workspace.
      const own = await prisma.attachment.findFirst({
        where: { id: att.id, uploaderId: userId, workspaceId, isDeleted: false },
        select: { id: true },
      });
      if (!own) return { ok: false, error: 'You can only attach files you uploaded' };
      items.push({ kind: 'link', id: own.id });
      continue;
    }

    const fileName = att.fileName || 'attachment';
    const fileType = att.fileType || 'application/octet-stream';
    const fileSize = att.fileSize || 0;
    const storageProvider = att.storageProvider || 'LOCAL';

    const looksInternal = !!att.fileKey || att.fileUrl.startsWith('/');
    if (looksInternal) {
      const fileKey = att.fileKey ?? '';
      if (!fileKey || att.fileUrl !== INTERNAL_FILE_PREFIX + fileKey) {
        return { ok: false, error: 'Invalid file attachment' };
      }
      // The caller must have uploaded this exact file to this workspace. Prefer an upload not yet attached anywhere.
      const owned = await prisma.attachment.findMany({
        where: { fileKey, uploaderId: userId, workspaceId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true, messageId: true },
      });
      if (owned.length === 0) return { ok: false, error: 'You can only attach files you uploaded' };
      const unattached = owned.find((o) => o.messageId === null);
      items.push(
        unattached
          ? { kind: 'link', id: unattached.id }
          : { kind: 'create', data: { fileName, fileKey, fileUrl: att.fileUrl, fileType, fileSize, storageProvider } },
      );
      continue;
    }

    if (!/^https?:\/\//i.test(att.fileUrl)) return { ok: false, error: 'Invalid file attachment' };
    items.push({ kind: 'create', data: { fileName, fileKey: att.fileUrl, fileUrl: att.fileUrl, fileType, fileSize, storageProvider } });
  }

  return { ok: true, items };
}

/** Applies prepared attachments to a message that has just been created. */
export async function applyAttachments(items: PreparedAttachment[], target: { messageId: string; channelId: string; workspaceId: string; uploaderId: string }) {
  for (const item of items) {
    if (item.kind === 'link') {
      await prisma.attachment.update({ where: { id: item.id }, data: { messageId: target.messageId, channelId: target.channelId } });
    } else {
      await prisma.attachment.create({
        data: {
          workspaceId: target.workspaceId,
          channelId: target.channelId,
          messageId: target.messageId,
          uploaderId: target.uploaderId,
          ...item.data,
        },
      });
    }
  }
}
