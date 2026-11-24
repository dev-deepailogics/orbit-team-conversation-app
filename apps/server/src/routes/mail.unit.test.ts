import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectProviderSettings,
  mapSpecialUse,
} from "../services/mailProviderConfig.js";

describe("Mail Provider Configuration & Auto-Detection", () => {
  it("auto-detects Gmail provider settings", () => {
    const settings = detectProviderSettings("user@gmail.com");
    assert.ok(settings);
    assert.equal(settings?.provider, "GMAIL");
    assert.equal(settings?.imapHost, "imap.gmail.com");
    assert.equal(settings?.imapPort, 993);
    assert.equal(settings?.smtpHost, "smtp.gmail.com");
    assert.equal(settings?.smtpPort, 465);
  });

  it("auto-detects Outlook/Office365 provider settings", () => {
    const settings = detectProviderSettings("colleague@outlook.com");
    assert.ok(settings);
    assert.equal(settings?.provider, "OUTLOOK");
    assert.equal(settings?.imapHost, "outlook.office365.com");
    assert.equal(settings?.smtpPort, 587);
    assert.equal(settings?.smtpSecurity, "STARTTLS");
  });

  it("auto-detects Yahoo provider settings", () => {
    const settings = detectProviderSettings("john@yahoo.com");
    assert.ok(settings);
    assert.equal(settings?.provider, "YAHOO");
    assert.equal(settings?.imapHost, "imap.mail.yahoo.com");
  });

  it("returns null for custom domains requiring manual setup", () => {
    const settings = detectProviderSettings("ceo@mycompany.org");
    assert.equal(settings, null);
  });

  it("correctly normalizes standard IMAP mailbox special-use tags and names", () => {
    assert.equal(mapSpecialUse("\\Inbox", "INBOX"), "INBOX");
    assert.equal(mapSpecialUse("\\Sent", "Sent Messages"), "SENT");
    assert.equal(mapSpecialUse("\\Drafts", "Drafts"), "DRAFTS");
    assert.equal(mapSpecialUse("\\Trash", "Deleted Items"), "TRASH");
    assert.equal(mapSpecialUse("\\Junk", "Spam"), "SPAM");
    assert.equal(mapSpecialUse("\\Archive", "Archives"), "ARCHIVE");
    assert.equal(mapSpecialUse(undefined, "Random Folder"), "CUSTOM");
  });
});
