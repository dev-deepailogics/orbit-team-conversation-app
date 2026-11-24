import { prisma } from "@orbit/db";
import { SendMailInput } from "@orbit/types";
import { createSmtpTransport } from "./mailClientFactory.js";

/**
 * Sends an email from an account using its configured SMTP transport,
 * records it in the database under the account's SENT folder, and links threading headers.
 */
export async function sendMail(
  userId: string,
  input: SendMailInput
): Promise<{ success: boolean; messageId: string; dbMessageId: string }> {
  // Enforce account belongs to user
  const account = await prisma.mailAccount.findFirst({
    where: {
      id: input.accountId,
      userId,
    },
  });

  if (!account) {
    throw new Error("Mail account not found or access denied");
  }

  if (account.status === "DISABLED") {
    throw new Error("Mail account is disabled");
  }

  const transporter = await createSmtpTransport(account);

  // Normalize recipients
  const normalizeRecipients = (
    recipients?: any[] | string[]
  ): string[] => {
    if (!recipients) return [];
    return recipients.map((r) => {
      if (typeof r === "string") return r.trim();
      return r.name ? `"${r.name}" <${r.address}>` : r.address;
    });
  };

  const toList = normalizeRecipients(input.to);
  const ccList = normalizeRecipients(input.cc);
  const bccList = normalizeRecipients(input.bcc);

  if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) {
    throw new Error("At least one recipient is required");
  }

  const fromString = account.displayName
    ? `"${account.displayName}" <${account.email}>`
    : account.email;

  // Build threading headers if replying or forwarding
  let inReplyTo = input.inReplyTo;
  let references = input.references;

  if (input.replyToMessageId && (!inReplyTo || !references)) {
    const parentMsg = await prisma.mailMessage.findFirst({
      where: {
        id: input.replyToMessageId,
        accountId: account.id,
      },
    });

    if (parentMsg) {
      inReplyTo = parentMsg.messageId;
      references = parentMsg.references
        ? `${parentMsg.references} ${parentMsg.messageId}`
        : parentMsg.messageId;
    }
  }

  const mailOptions: any = {
    from: fromString,
    to: toList,
    cc: ccList.length > 0 ? ccList : undefined,
    bcc: bccList.length > 0 ? bccList : undefined,
    subject: input.subject || "(No Subject)",
    text: input.bodyText || "",
    html: input.bodyHtml || undefined,
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
  }
  if (references) {
    mailOptions.references = references;
  }

  // Send email via SMTP
  const info = await transporter.sendMail(mailOptions);
  const sentMessageId = info.messageId || `<${Date.now()}.${Math.random().toString(36).slice(2)}@orbit.local>`;

  // Locate or create SENT folder
  let sentFolder = await prisma.mailFolder.findFirst({
    where: {
      accountId: account.id,
      specialUse: "SENT",
    },
  });

  if (!sentFolder) {
    sentFolder = await prisma.mailFolder.create({
      data: {
        accountId: account.id,
        name: "Sent",
        path: "Sent",
        specialUse: "SENT",
      },
    });
  }

  // Record in DB as sent message
  const toObjects = toList.map((addr) => ({ address: addr }));
  const ccObjects = ccList.map((addr) => ({ address: addr }));
  const bccObjects = bccList.map((addr) => ({ address: addr }));

  const saved = await prisma.mailMessage.create({
    data: {
      accountId: account.id,
      folderId: sentFolder.id,
      messageId: sentMessageId,
      inReplyTo,
      references,
      from: fromString,
      to: toObjects,
      cc: ccObjects,
      bcc: bccObjects,
      subject: input.subject || "(No Subject)",
      snippet: (input.bodyText || "").slice(0, 200),
      bodyText: input.bodyText || "",
      bodyHtml: input.bodyHtml || "",
      date: new Date(),
      isRead: true,
      isDraft: false,
    },
  });

  // If this was sent from a draft, delete the draft
  if (input.draftId) {
    await prisma.mailMessage
      .delete({
        where: { id: input.draftId },
      })
      .catch(() => {});
  }

  return {
    success: true,
    messageId: sentMessageId,
    dbMessageId: saved.id,
  };
}
