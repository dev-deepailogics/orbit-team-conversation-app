import { ImapFlow } from "imapflow";
import nodemailer, { Transporter } from "nodemailer";
import { MailAccount } from "@prisma/client";
import { decryptCredentials } from "./mailCrypto.js";
import { assertPublicHost } from "./mailSsrf.js";

export interface DecryptedCredentials {
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export function parseDecryptedCredentials(
  encryptedString: string
): DecryptedCredentials {
  const creds = decryptCredentials<any>(encryptedString);
  if (typeof creds === "string") {
    return { password: creds };
  }
  return creds || {};
}

/**
 * Creates an ImapFlow instance for an account
 */
export async function createImapClient(account: MailAccount): Promise<ImapFlow> {
  const host = account.imapHost || "imap.gmail.com";
  const port = account.imapPort || 993;
  const isSecure = account.imapSecurity !== "NONE" && account.imapSecurity !== "STARTTLS";

  // Enforce SSRF protection
  await assertPublicHost(host);

  const creds = parseDecryptedCredentials(account.encryptedCredentials);

  let auth: any = { user: account.email };
  if (account.authType === "OAUTH2" && creds.accessToken) {
    auth = {
      user: account.email,
      accessToken: creds.accessToken,
    };
  } else {
    auth = {
      user: account.email,
      pass: creds.password || "",
    };
  }

  const client = new ImapFlow({
    host,
    port,
    secure: isSecure,
    auth,
    logger: false,
    emitLogs: false,
    clientInfo: {
      name: "Orbit Webmail",
      version: "0.1.0",
    },
  });

  return client;
}

/**
 * Creates a Nodemailer transport instance for an account
 */
export async function createSmtpTransport(
  account: MailAccount
): Promise<Transporter> {
  const host = account.smtpHost || "smtp.gmail.com";
  const port = account.smtpPort || 465;
  const isSecure = account.smtpSecurity === "SSL" || port === 465;

  // Enforce SSRF protection
  await assertPublicHost(host);

  const creds = parseDecryptedCredentials(account.encryptedCredentials);

  let auth: any;
  if (account.authType === "OAUTH2" && creds.accessToken) {
    auth = {
      type: "OAuth2",
      user: account.email,
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
    };
  } else {
    auth = {
      user: account.email,
      pass: creds.password || "",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth,
    tls: {
      rejectUnauthorized: true,
    },
  });

  return transporter;
}

/**
 * Tests connection to both IMAP and SMTP servers
 */
export async function testConnection(options: {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecurity?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity?: string;
  authType: "PASSWORD" | "OAUTH2";
  password?: string;
  accessToken?: string;
}): Promise<{ imapOk: boolean; smtpOk: boolean; error?: string }> {
  // SSRF check on both hosts
  await assertPublicHost(options.imapHost);
  await assertPublicHost(options.smtpHost);

  // 1. Test IMAP
  let imapOk = false;
  let imapError: string | undefined;
  const isImapSecure =
    options.imapSecurity !== "NONE" && options.imapSecurity !== "STARTTLS";

  const imapAuth =
    options.authType === "OAUTH2" && options.accessToken
      ? { user: options.email, accessToken: options.accessToken }
      : { user: options.email, pass: options.password || "" };

  const imapClient = new ImapFlow({
    host: options.imapHost,
    port: options.imapPort,
    secure: isImapSecure,
    auth: imapAuth,
    logger: false,
    emitLogs: false,
  });

  try {
    await imapClient.connect();
    imapOk = true;
  } catch (err: any) {
    imapError = `IMAP connection failed: ${err.message || String(err)}`;
  } finally {
    try {
      await imapClient.logout();
    } catch {
      // Ignore logout cleanup error
    }
  }

  if (!imapOk) {
    return { imapOk: false, smtpOk: false, error: imapError };
  }

  // 2. Test SMTP
  let smtpOk = false;
  let smtpError: string | undefined;
  const isSmtpSecure =
    options.smtpSecurity === "SSL" || options.smtpPort === 465;

  const smtpAuth =
    options.authType === "OAUTH2" && options.accessToken
      ? { type: "OAuth2", user: options.email, accessToken: options.accessToken }
      : { user: options.email, pass: options.password || "" };

  const transporter = nodemailer.createTransport({
    host: options.smtpHost,
    port: options.smtpPort,
    secure: isSmtpSecure,
    auth: smtpAuth,
  });

  try {
    await transporter.verify();
    smtpOk = true;
  } catch (err: any) {
    smtpError = `SMTP verification failed: ${err.message || String(err)}`;
  }

  return {
    imapOk,
    smtpOk,
    error: smtpOk ? undefined : smtpError,
  };
}
