import { MailFolderSpecialUse, MailProvider } from "@orbit/types";

export interface ProviderPreset {
  provider: MailProvider;
  imapHost: string;
  imapPort: number;
  imapSecurity: "SSL" | "STARTTLS";
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "SSL" | "STARTTLS";
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  GMAIL: {
    provider: "GMAIL",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecurity: "SSL",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecurity: "SSL",
  },
  OUTLOOK: {
    provider: "OUTLOOK",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecurity: "SSL",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecurity: "STARTTLS",
  },
  YAHOO: {
    provider: "YAHOO",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecurity: "SSL",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecurity: "SSL",
  },
  ZOHO: {
    provider: "CUSTOM",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapSecurity: "SSL",
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecurity: "SSL",
  },
};

/**
 * Auto-detects standard mail provider settings based on the email domain
 */
export function detectProviderSettings(email: string): ProviderPreset | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return PROVIDER_PRESETS.GMAIL;
  }
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com" ||
    domain === "office365.com"
  ) {
    return PROVIDER_PRESETS.OUTLOOK;
  }
  if (
    domain === "yahoo.com" ||
    domain === "ymail.com" ||
    domain === "rocketmail.com"
  ) {
    return PROVIDER_PRESETS.YAHOO;
  }
  if (domain === "zoho.com") {
    return PROVIDER_PRESETS.ZOHO;
  }

  return null;
}

/**
 * Maps IMAP special-use flags or mailbox names to Orbit standard folder types
 */
export function mapSpecialUse(
  specialUseTag?: string,
  folderName?: string
): MailFolderSpecialUse {
  const tag = (specialUseTag || "").toLowerCase();
  const name = (folderName || "").toLowerCase();

  if (tag.includes("\\inbox") || name === "inbox") return "INBOX";
  if (tag.includes("\\sent") || name.includes("sent")) return "SENT";
  if (tag.includes("\\drafts") || name.includes("draft")) return "DRAFTS";
  if (
    tag.includes("\\trash") ||
    name.includes("trash") ||
    name.includes("deleted items") ||
    name.includes("bin")
  ) {
    return "TRASH";
  }
  if (
    tag.includes("\\junk") ||
    tag.includes("\\spam") ||
    name.includes("spam") ||
    name.includes("junk")
  ) {
    return "SPAM";
  }
  if (tag.includes("\\archive") || name.includes("archive")) return "ARCHIVE";
  if (tag.includes("\\flagged") || tag.includes("\\starred") || name.includes("starred")) {
    return "STARRED";
  }

  return "CUSTOM";
}
