import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import fs from "fs";
import { prisma } from "@orbit/db";
import { encryptCredentials } from "../services/mailCrypto.js";
import { detectProviderSettings } from "../services/mailProviderConfig.js";
import { testConnection } from "../services/mailClientFactory.js";
import { queueMailSync, queueMailSend } from "../services/mailQueue.js";
import { assertPublicHost } from "../services/mailSsrf.js";

// Rate limiting map for sending emails: userId -> timestamp[]
const sendRateLimits = new Map<string, number[]>();
const MAX_EMAILS_PER_MINUTE = 15;

function checkSendRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (sendRateLimits.get(userId) || []).filter(
    (t) => now - t < windowMs
  );
  if (timestamps.length >= MAX_EMAILS_PER_MINUTE) {
    return false;
  }
  timestamps.push(now);
  sendRateLimits.set(userId, timestamps);
  return true;
}

const CreateAccountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  provider: z.enum(["GMAIL", "OUTLOOK", "YAHOO", "CUSTOM"]).default("CUSTOM"),
  authType: z.enum(["PASSWORD", "OAUTH2"]).default("PASSWORD"),
  password: z.string().optional(),
  oauthTokens: z
    .object({
      accessToken: z.string(),
      refreshToken: z.string().optional(),
    })
    .optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().optional(),
  imapSecurity: z.enum(["SSL", "STARTTLS", "NONE"]).default("SSL"),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpSecurity: z.enum(["SSL", "STARTTLS", "NONE"]).default("SSL"),
});

const UpdateAccountSchema = z.object({
  displayName: z.string().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().optional(),
  imapSecurity: z.enum(["SSL", "STARTTLS", "NONE"]).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpSecurity: z.enum(["SSL", "STARTTLS", "NONE"]).optional(),
  password: z.string().optional(),
});

const SendMailSchema = z.object({
  accountId: z.string().uuid(),
  to: z.array(z.union([z.string(), z.object({ name: z.string().optional(), address: z.string() })])),
  cc: z.array(z.union([z.string(), z.object({ name: z.string().optional(), address: z.string() })])).optional(),
  bcc: z.array(z.union([z.string(), z.object({ name: z.string().optional(), address: z.string() })])).optional(),
  subject: z.string().default(""),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  replyToMessageId: z.string().optional(),
  draftId: z.string().optional(),
});

const BulkActionSchema = z.object({
  messageIds: z.array(z.string().uuid()),
  action: z.enum(["read", "unread", "star", "unstar", "delete", "move"]),
  targetFolderId: z.string().uuid().optional(),
});

export async function mailRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // Apply JWT authentication to all mail endpoints
  fastify.addHook("preHandler", fastify.authenticate);

  // 1. GET /api/mail/accounts - List user's mail accounts
  fastify.get("/accounts", async (request: FastifyRequest, reply) => {
    const userId = (request.user as { id: string }).id;
    const accounts = await prisma.mailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        provider: true,
        authType: true,
        imapHost: true,
        imapPort: true,
        imapSecurity: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecurity: true,
        status: true,
        lastSyncedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Compute unread counts per account
    const accountsWithCounts = await Promise.all(
      accounts.map(async (acc) => {
        const unreadCount = await prisma.mailMessage.count({
          where: {
            accountId: acc.id,
            isRead: false,
          },
        });
        return { ...acc, unreadCount };
      })
    );

    return reply.send(accountsWithCounts);
  });

  // 2. POST /api/mail/accounts/test - Test connection before saving
  fastify.post("/accounts/test", async (request: FastifyRequest, reply) => {
    const body = CreateAccountSchema.parse(request.body);

    const preset = detectProviderSettings(body.email);
    const imapHost = body.imapHost || preset?.imapHost;
    const imapPort = body.imapPort || preset?.imapPort || 993;
    const imapSecurity = body.imapSecurity || preset?.imapSecurity || "SSL";
    const smtpHost = body.smtpHost || preset?.smtpHost;
    const smtpPort = body.smtpPort || preset?.smtpPort || 465;
    const smtpSecurity = body.smtpSecurity || preset?.smtpSecurity || "SSL";

    if (!imapHost || !smtpHost) {
      return reply.status(400).send({
        error: "IMAP and SMTP hosts are required",
      });
    }

    try {
      const result = await testConnection({
        email: body.email,
        imapHost,
        imapPort,
        imapSecurity,
        smtpHost,
        smtpPort,
        smtpSecurity,
        authType: body.authType,
        password: body.password,
        accessToken: body.oauthTokens?.accessToken,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        imapOk: false,
        smtpOk: false,
        error: err.message || "Connection test failed",
      });
    }
  });

  // 3. POST /api/mail/accounts - Connect a new mail account
  fastify.post("/accounts", async (request: FastifyRequest, reply) => {
    try {
      const userId = (request.user as { id: string }).id;
      const body = CreateAccountSchema.parse(request.body);

      // Auto-detect settings if provider is not custom or hosts missing
      const preset = detectProviderSettings(body.email);
      const provider = body.provider !== "CUSTOM" ? body.provider : (preset?.provider || "CUSTOM");
      const imapHost = body.imapHost || preset?.imapHost;
      const imapPort = body.imapPort || preset?.imapPort || 993;
      const imapSecurity = body.imapSecurity || preset?.imapSecurity || "SSL";
      const smtpHost = body.smtpHost || preset?.smtpHost;
      const smtpPort = body.smtpPort || preset?.smtpPort || 465;
      const smtpSecurity = body.smtpSecurity || preset?.smtpSecurity || "SSL";

      if (!imapHost || !smtpHost) {
        return reply.status(400).send({
          error: "IMAP and SMTP hosts could not be determined. Please specify them manually.",
        });
      }

      // SSRF checks
      await assertPublicHost(imapHost);
      await assertPublicHost(smtpHost);

      // Encrypt credentials
      const credsPayload =
        body.authType === "OAUTH2" ? body.oauthTokens : { password: body.password };
      const encryptedCredentials = encryptCredentials(credsPayload);

      // Save account
      const account = await prisma.mailAccount.create({
        data: {
          userId,
          email: body.email.toLowerCase().trim(),
          displayName: body.displayName || body.email.split("@")[0],
          provider,
          authType: body.authType,
          imapHost,
          imapPort,
          imapSecurity,
          smtpHost,
          smtpPort,
          smtpSecurity,
          encryptedCredentials,
          status: "ACTIVE",
        },
      });

      // Enqueue initial sync job
      await queueMailSync(account.id);

      return reply.status(201).send({
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        provider: account.provider,
        status: account.status,
      });
    } catch (err: any) {
      fastify.log.error(err, "Failed to connect mail account");
      return reply.status(err.statusCode || 400).send({
        error: err.message || "Failed to connect mail account",
      });
    }
  });

  // 4. PATCH /api/mail/accounts/:id - Edit account
  fastify.patch("/accounts/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const userId = (request.user as { id: string }).id;
    const { id } = request.params;
    const body = UpdateAccountSchema.parse(request.body);

    const account = await prisma.mailAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return reply.status(404).send({ error: "Account not found" });
    }

    const updateData: any = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.imapHost !== undefined) {
      await assertPublicHost(body.imapHost);
      updateData.imapHost = body.imapHost;
    }
    if (body.imapPort !== undefined) updateData.imapPort = body.imapPort;
    if (body.imapSecurity !== undefined) updateData.imapSecurity = body.imapSecurity;
    if (body.smtpHost !== undefined) {
      await assertPublicHost(body.smtpHost);
      updateData.smtpHost = body.smtpHost;
    }
    if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort;
    if (body.smtpSecurity !== undefined) updateData.smtpSecurity = body.smtpSecurity;
    if (body.password) {
      updateData.encryptedCredentials = encryptCredentials({ password: body.password });
    }

    const updated = await prisma.mailAccount.update({
      where: { id },
      data: updateData,
    });

    return reply.send({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      status: updated.status,
    });
  });

  // 5. DELETE /api/mail/accounts/:id - Delete account
  fastify.delete("/accounts/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const userId = (request.user as { id: string }).id;
    const { id } = request.params;

    const account = await prisma.mailAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return reply.status(404).send({ error: "Account not found" });
    }

    await prisma.mailAccount.delete({
      where: { id },
    });

    return reply.send({ success: true, message: "Account deleted" });
  });

  // 6. POST /api/mail/accounts/:id/sync - Trigger sync
  fastify.post("/accounts/:id/sync", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const userId = (request.user as { id: string }).id;
    const { id } = request.params;

    const account = await prisma.mailAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return reply.status(404).send({ error: "Account not found" });
    }

    await queueMailSync(account.id);
    return reply.send({ success: true, message: "Sync job enqueued" });
  });

  // 7. GET /api/mail/folders - List folders
  fastify.get("/folders", async (request: FastifyRequest<{ Querystring: { accountId?: string } }>, reply) => {
    const userId = (request.user as { id: string }).id;
    const { accountId } = request.query;

    const accountWhere: any = { userId };
    if (accountId) {
      accountWhere.id = accountId;
    }

    const userAccounts = await prisma.mailAccount.findMany({
      where: accountWhere,
      select: { id: true },
    });

    const accountIds = userAccounts.map((a) => a.id);

    const folders = await prisma.mailFolder.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { name: "asc" },
    });

    // Include unread count for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (f) => {
        const unreadCount = await prisma.mailMessage.count({
          where: {
            folderId: f.id,
            isRead: false,
          },
        });
        const totalCount = await prisma.mailMessage.count({
          where: { folderId: f.id },
        });
        return {
          id: f.id,
          accountId: f.accountId,
          name: f.name,
          path: f.path,
          specialUse: f.specialUse,
          uidValidity: f.uidValidity ? f.uidValidity.toString() : null,
          lastUid: f.lastUid,
          unreadCount,
          totalCount,
        };
      })
    );

    return reply.send(foldersWithCounts);
  });

  // 8. GET /api/mail/messages - List messages with search & filtering
  fastify.get(
    "/messages",
    async (
      request: FastifyRequest<{
        Querystring: {
          accountId?: string;
          folderId?: string;
          specialUse?: string;
          filter?: "unread" | "starred" | "attachments";
          search?: string;
          page?: string;
          limit?: string;
        };
      }>,
      reply
    ) => {
      const userId = (request.user as { id: string }).id;
      const { accountId, folderId, specialUse, filter, search, page = "1", limit = "30" } = request.query;

      const userAccounts = await prisma.mailAccount.findMany({
        where: { userId },
        select: { id: true, email: true },
      });
      const userAccountMap = new Map(userAccounts.map((a) => [a.id, a.email]));
      const allowedAccountIds = Array.from(userAccountMap.keys());

      const where: any = {
        accountId: accountId && allowedAccountIds.includes(accountId)
          ? accountId
          : { in: allowedAccountIds },
      };

      if (folderId) {
        where.folderId = folderId;
      } else if (specialUse) {
        where.folder = { specialUse };
      }

      if (filter === "unread") where.isRead = false;
      if (filter === "starred") where.isStarred = true;
      if (filter === "attachments") where.hasAttachments = true;

      if (search && search.trim()) {
        const query = search.trim();
        where.OR = [
          { subject: { contains: query, mode: "insensitive" } },
          { from: { contains: query, mode: "insensitive" } },
          { snippet: { contains: query, mode: "insensitive" } },
          { bodyText: { contains: query, mode: "insensitive" } },
        ];
      }

      const take = Math.min(parseInt(limit, 10) || 30, 100);
      const skip = ((parseInt(page, 10) || 1) - 1) * take;

      const [total, messages] = await Promise.all([
        prisma.mailMessage.count({ where }),
        prisma.mailMessage.findMany({
          where,
          orderBy: { date: "desc" },
          take,
          skip,
          select: {
            id: true,
            accountId: true,
            folderId: true,
            uid: true,
            messageId: true,
            threadId: true,
            from: true,
            to: true,
            subject: true,
            snippet: true,
            date: true,
            isRead: true,
            isStarred: true,
            isDraft: true,
            hasAttachments: true,
            createdAt: true,
          },
        }),
      ]);

      const formatted = messages.map((m) => ({
        ...m,
        date: m.date.toISOString(),
        createdAt: m.createdAt.toISOString(),
        accountEmail: userAccountMap.get(m.accountId),
      }));

      return reply.send({
        messages: formatted,
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      });
    }
  );

  // 9. GET /api/mail/messages/:id - Full message details with attachments
  fastify.get(
    "/messages/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const userId = (request.user as { id: string }).id;
      const { id } = request.params;

      const message = await prisma.mailMessage.findFirst({
        where: {
          id,
          account: { userId },
        },
        include: {
          attachments: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
              contentId: true,
              createdAt: true,
            },
          },
          account: {
            select: { email: true, displayName: true },
          },
        },
      });

      if (!message) {
        return reply.status(404).send({ error: "Message not found" });
      }

      // Automatically mark as read if not already read
      if (!message.isRead) {
        await prisma.mailMessage.update({
          where: { id: message.id },
          data: { isRead: true },
        });
      }

      return reply.send({
        ...message,
        date: message.date.toISOString(),
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        isRead: true,
        accountEmail: message.account.email,
      });
    }
  );

  // 10. PATCH /api/mail/messages/:id - Toggle read/starred/move folder
  fastify.patch(
    "/messages/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          isRead?: boolean;
          isStarred?: boolean;
          folderId?: string;
        };
      }>,
      reply
    ) => {
      const userId = (request.user as { id: string }).id;
      const { id } = request.params;
      const { isRead, isStarred, folderId } = request.body;

      const message = await prisma.mailMessage.findFirst({
        where: { id, account: { userId } },
      });

      if (!message) {
        return reply.status(404).send({ error: "Message not found" });
      }

      const updateData: any = {};
      if (isRead !== undefined) updateData.isRead = isRead;
      if (isStarred !== undefined) updateData.isStarred = isStarred;
      if (folderId !== undefined) {
        const folder = await prisma.mailFolder.findFirst({
          where: { id: folderId, accountId: message.accountId },
        });
        if (!folder) {
          return reply.status(400).send({ error: "Target folder not found in this account" });
        }
        updateData.folderId = folderId;
      }

      const updated = await prisma.mailMessage.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        id: updated.id,
        isRead: updated.isRead,
        isStarred: updated.isStarred,
        folderId: updated.folderId,
      });
    }
  );

  // 11. POST /api/mail/messages/bulk - Bulk actions (read, star, delete, move)
  fastify.post("/messages/bulk", async (request: FastifyRequest, reply) => {
    const userId = (request.user as { id: string }).id;
    const body = BulkActionSchema.parse(request.body);

    const userAccounts = await prisma.mailAccount.findMany({
      where: { userId },
      select: { id: true },
    });
    const allowedAccountIds = userAccounts.map((a) => a.id);

    const messageFilter = {
      id: { in: body.messageIds },
      accountId: { in: allowedAccountIds },
    };

    if (body.action === "read") {
      await prisma.mailMessage.updateMany({
        where: messageFilter,
        data: { isRead: true },
      });
    } else if (body.action === "unread") {
      await prisma.mailMessage.updateMany({
        where: messageFilter,
        data: { isRead: false },
      });
    } else if (body.action === "star") {
      await prisma.mailMessage.updateMany({
        where: messageFilter,
        data: { isStarred: true },
      });
    } else if (body.action === "unstar") {
      await prisma.mailMessage.updateMany({
        where: messageFilter,
        data: { isStarred: false },
      });
    } else if (body.action === "delete") {
      await prisma.mailMessage.deleteMany({
        where: messageFilter,
      });
    } else if (body.action === "move" && body.targetFolderId) {
      await prisma.mailMessage.updateMany({
        where: messageFilter,
        data: { folderId: body.targetFolderId },
      });
    }

    return reply.send({ success: true, count: body.messageIds.length });
  });

  // 12. POST /api/mail/send - Send mail
  fastify.post("/send", async (request: FastifyRequest, reply) => {
    const userId = (request.user as { id: string }).id;

    if (!checkSendRateLimit(userId)) {
      return reply.status(429).send({
        error: "Sending rate limit exceeded. Please wait a moment before sending more emails.",
      });
    }

    const body = SendMailSchema.parse(request.body);
    const result = await queueMailSend(userId, body);

    return reply.status(200).send(result);
  });

  // 13. POST /api/mail/drafts - Save or update draft
  fastify.post("/drafts", async (request: FastifyRequest, reply) => {
    const userId = (request.user as { id: string }).id;
    const body = SendMailSchema.parse(request.body);

    const account = await prisma.mailAccount.findFirst({
      where: { id: body.accountId, userId },
    });

    if (!account) {
      return reply.status(404).send({ error: "Mail account not found" });
    }

    let draftsFolder = await prisma.mailFolder.findFirst({
      where: { accountId: account.id, specialUse: "DRAFTS" },
    });

    if (!draftsFolder) {
      draftsFolder = await prisma.mailFolder.create({
        data: {
          accountId: account.id,
          name: "Drafts",
          path: "Drafts",
          specialUse: "DRAFTS",
        },
      });
    }

    const draftData = {
      accountId: account.id,
      folderId: draftsFolder.id,
      messageId: `<draft-${Date.now()}-${Math.random().toString(36).slice(2)}@orbit.local>`,
      from: account.displayName
        ? `"${account.displayName}" <${account.email}>`
        : account.email,
      to: body.to as any,
      cc: (body.cc || []) as any,
      bcc: (body.bcc || []) as any,
      subject: body.subject || "(Draft)",
      snippet: (body.bodyText || "").slice(0, 200),
      bodyText: body.bodyText || "",
      bodyHtml: body.bodyHtml || "",
      isRead: true,
      isDraft: true,
      inReplyTo: body.inReplyTo,
      references: body.references,
    };

    let draft;
    if (body.draftId) {
      draft = await prisma.mailMessage.update({
        where: { id: body.draftId },
        data: draftData,
      });
    } else {
      draft = await prisma.mailMessage.create({
        data: draftData,
      });
    }

    return reply.send({ success: true, draftId: draft.id });
  });

  // 14. GET /api/mail/attachments/:id/download - Stream attachment download
  fastify.get(
    "/attachments/:id/download",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const userId = (request.user as { id: string }).id;
      const { id } = request.params;

      const attachment = await prisma.mailAttachment.findFirst({
        where: {
          id,
          message: { account: { userId } },
        },
      });

      if (!attachment || !attachment.storagePath) {
        return reply.status(404).send({ error: "Attachment not found" });
      }

      if (!fs.existsSync(attachment.storagePath)) {
        return reply.status(404).send({ error: "Attachment file missing from disk" });
      }

      const stream = fs.createReadStream(attachment.storagePath);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(attachment.filename)}"`
      );
      reply.header("Content-Type", attachment.mimeType);
      return reply.send(stream);
    }
  );
}
