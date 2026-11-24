import fs from "fs/promises";
import path from "path";
import { simpleParser } from "mailparser";
import { prisma } from "@orbit/db";
import { MailAccount, MailFolder } from "@prisma/client";
import { createImapClient } from "./mailClientFactory.js";
import { mapSpecialUse } from "./mailProviderConfig.js";

const BATCH_SIZE = 50;
const INITIAL_SYNC_DAYS = 30;

function getMailUploadsDir(accountId: string, messageId: string): string {
  const baseUploads =
    process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
  return path.join(baseUploads, "mail", accountId, messageId.replace(/[^a-zA-Z0-9-_]/g, "_"));
}

/**
 * Synchronizes mail folders and messages for a given mail account
 */
export async function syncMailAccount(
  accountId: string,
  onProgress?: (info: { status: string; progress?: number }) => void
): Promise<{ foldersSynced: number; messagesSynced: number }> {
  const account = await prisma.mailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Mail account ${accountId} not found`);
  }

  if (account.status === "DISABLED") {
    return { foldersSynced: 0, messagesSynced: 0 };
  }

  // Update status to SYNCING
  await prisma.mailAccount.update({
    where: { id: accountId },
    data: { status: "SYNCING", lastError: null },
  });

  onProgress?.({ status: "Connecting to IMAP server..." });
  const client = await createImapClient(account);

  let totalMessagesSynced = 0;
  let foldersSyncedCount = 0;

  try {
    await client.connect();

    // 1. Sync Mailbox Folders
    onProgress?.({ status: "Fetching mailbox folders..." });
    const mailboxes = await client.list();

    const existingFolders = await prisma.mailFolder.findMany({
      where: { accountId },
    });
    const folderByPath = new Map<string, MailFolder>(
      existingFolders.map((f) => [f.path, f])
    );

    const activeFolders: MailFolder[] = [];

    for (const mbox of mailboxes) {
      const specialUse = mapSpecialUse(mbox.specialUse, mbox.name);
      let folder = folderByPath.get(mbox.path);

      if (!folder) {
        folder = await prisma.mailFolder.create({
          data: {
            accountId,
            name: mbox.name,
            path: mbox.path,
            specialUse,
          },
        });
      } else {
        folder = await prisma.mailFolder.update({
          where: { id: folder.id },
          data: {
            name: mbox.name,
            specialUse: folder.specialUse === "CUSTOM" ? specialUse : folder.specialUse,
          },
        });
      }
      activeFolders.push(folder);
      foldersSyncedCount++;
    }

    // 2. Sync Messages for each folder (prioritizing INBOX, SENT, DRAFTS)
    const sortedFolders = [...activeFolders].sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        INBOX: 0,
        SENT: 1,
        DRAFTS: 2,
        STARRED: 3,
        ARCHIVE: 4,
        CUSTOM: 5,
        SPAM: 6,
        TRASH: 7,
      };
      return (priorityOrder[a.specialUse] ?? 10) - (priorityOrder[b.specialUse] ?? 10);
    });

    for (const folder of sortedFolders) {
      try {
        const lock = await client.getMailboxLock(folder.path);
        try {
          const status = client.mailbox;
          if (!status || status.exists === 0) {
            continue;
          }

          // Check UIDVALIDITY
          const currentValidity = BigInt(status.uidValidity);
          let lastUid = folder.lastUid || 0;

          if (folder.uidValidity && folder.uidValidity !== currentValidity) {
            // UIDVALIDITY changed: cache is invalid, clear existing messages in this folder
            await prisma.mailMessage.deleteMany({
              where: { folderId: folder.id },
            });
            lastUid = 0;
          }

          // Determine message search criteria
          let range: string;
          if (lastUid > 0) {
            // Incremental sync
            range = `${lastUid + 1}:*`;
          } else {
            // Initial sync: fetch last INITIAL_SYNC_DAYS days
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - INITIAL_SYNC_DAYS);
            range = "1:*";
          }

          let highestSeenUid = lastUid;
          const messagesToProcess: any[] = [];

          const fetchMessages = client.fetch(
            range,
            {
              uid: true,
              flags: true,
              envelope: true,
              internalDate: true,
              source: true,
            },
            { uid: lastUid > 0 }
          );

          for await (const msg of fetchMessages) {
            if (msg.uid > highestSeenUid) {
              highestSeenUid = msg.uid;
            }
            messagesToProcess.push(msg);

            // Process in batches of BATCH_SIZE
            if (messagesToProcess.length >= BATCH_SIZE) {
              const count = await processBatch(
                account,
                folder,
                messagesToProcess.splice(0, BATCH_SIZE)
              );
              totalMessagesSynced += count;
            }
          }

          // Process remaining messages in the buffer
          if (messagesToProcess.length > 0) {
            const count = await processBatch(
              account,
              folder,
              messagesToProcess.splice(0, messagesToProcess.length)
            );
            totalMessagesSynced += count;
          }

          // Update folder with current UID validity and highest seen UID
          await prisma.mailFolder.update({
            where: { id: folder.id },
            data: {
              uidValidity: currentValidity,
              lastUid: highestSeenUid,
            },
          });
        } finally {
          lock.release();
        }
      } catch (folderErr: any) {
        // Individual folder sync error shouldn't crash other folders
        console.warn(
          `Could not sync folder ${folder.name} for account ${account.email}:`,
          folderErr.message
        );
      }
    }

    // Mark account as active & updated
    await prisma.mailAccount.update({
      where: { id: accountId },
      data: {
        status: "ACTIVE",
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });

    onProgress?.({
      status: `Sync complete: ${totalMessagesSynced} messages synced`,
    });

    return {
      foldersSynced: foldersSyncedCount,
      messagesSynced: totalMessagesSynced,
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    await prisma.mailAccount.update({
      where: { id: accountId },
      data: {
        status: "ERROR",
        lastError: errorMsg,
      },
    });
    throw err;
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Parses and persists a batch of IMAP messages
 */
async function processBatch(
  account: MailAccount,
  folder: MailFolder,
  messages: any[]
): Promise<number> {
  let savedCount = 0;

  for (const msg of messages) {
    try {
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);
      const messageId =
        parsed.messageId ||
        `<synthetic-${account.id}-${folder.id}-${msg.uid}@orbit.local>`;

      // Format recipient lists
      const formatAddresses = (field: any) => {
        if (!field) return [];
        const list = Array.isArray(field) ? field : [field];
        const res: { name?: string; address: string }[] = [];
        for (const item of list) {
          if (item?.value) {
            for (const addr of item.value) {
              if (addr?.address) {
                res.push({
                  name: addr.name || undefined,
                  address: addr.address.toLowerCase(),
                });
              }
            }
          } else if (item?.text) {
            res.push({ address: item.text });
          }
        }
        return res;
      };

      const toList = formatAddresses(parsed.to);
      const ccList = formatAddresses(parsed.cc);
      const bccList = formatAddresses(parsed.bcc);
      const fromAddr =
        parsed.from?.value?.[0]?.address ||
        parsed.from?.text ||
        account.email;

      const flags = msg.flags ? Array.from(msg.flags) : [];
      const isRead = flags.includes("\\Seen");
      const isStarred = flags.includes("\\Flagged");
      const isDraft = flags.includes("\\Draft");

      const inReplyTo = parsed.inReplyTo || undefined;
      const references = Array.isArray(parsed.references)
        ? parsed.references.join(" ")
        : parsed.references || undefined;

      const snippet = (parsed.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      const hasAttachments = (parsed.attachments && parsed.attachments.length > 0) || false;

      // Upsert message in DB
      const savedMessage = await prisma.mailMessage.upsert({
        where: {
          accountId_folderId_messageId: {
            accountId: account.id,
            folderId: folder.id,
            messageId,
          },
        },
        create: {
          accountId: account.id,
          folderId: folder.id,
          uid: msg.uid,
          messageId,
          inReplyTo,
          references,
          from: fromAddr,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: parsed.subject || "(No Subject)",
          snippet,
          bodyText: parsed.text || "",
          bodyHtml: (parsed.html as string) || (parsed.textAsHtml as string) || "",
          date: parsed.date || msg.internalDate || new Date(),
          isRead,
          isStarred,
          isDraft,
          hasAttachments,
        },
        update: {
          uid: msg.uid,
          isRead,
          isStarred,
          isDraft,
        },
      });

      // Save attachments if any
      if (hasAttachments && parsed.attachments) {
        const uploadDir = getMailUploadsDir(account.id, messageId);
        await fs.mkdir(uploadDir, { recursive: true });

        for (const att of parsed.attachments) {
          const safeFilename = (att.filename || "attachment")
            .replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = path.join(uploadDir, safeFilename);

          await fs.writeFile(filePath, att.content);

          const existingAtt = await prisma.mailAttachment.findFirst({
            where: {
              messageId: savedMessage.id,
              filename: safeFilename,
            },
          });

          if (!existingAtt) {
            await prisma.mailAttachment.create({
              data: {
                messageId: savedMessage.id,
                filename: safeFilename,
                mimeType: att.contentType || "application/octet-stream",
                size: att.size || att.content.length,
                storagePath: filePath,
                contentId: att.contentId,
              },
            });
          }
        }
      }

      savedCount++;
    } catch (msgErr: any) {
      console.warn("Error parsing individual IMAP message:", msgErr.message);
    }
  }

  return savedCount;
}
