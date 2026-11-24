"use client";

import React from "react";
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Star,
  Mail,
  Download,
  Paperclip,
  Calendar,
  User,
  FolderInput,
} from "lucide-react";
import { useMailStore } from "@/stores/mailStore";
import { SandboxedMailViewer } from "./SandboxedMailViewer";
import { format } from "date-fns";

export const MailMessageDetail: React.FC = () => {
  const {
    selectedMessage,
    folders,
    isLoadingDetail,
    toggleStar,
    toggleRead,
    deleteMessage,
    moveMessage,
    openCompose,
  } = useMailStore();

  if (isLoadingDetail) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center h-full text-xs text-[var(--theme-text-muted)]"
        style={{ backgroundColor: "var(--theme-bg-surface)" }}
      >
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span>Loading message details...</span>
      </div>
    );
  }

  if (!selectedMessage) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center h-full text-xs text-[var(--theme-text-muted)] p-8 text-center"
        style={{ backgroundColor: "var(--theme-bg-surface)" }}
      >
        <Mail size={36} className="mb-3 opacity-30 text-[var(--theme-text)]" />
        <span className="font-semibold text-sm mb-1 text-[var(--theme-text)]">
          Select a message
        </span>
        <span>Choose an email from the list to read its contents and attachments.</span>
      </div>
    );
  }

  const handleReply = () => {
    openCompose({
      accountId: selectedMessage.accountId,
      to: [{ address: selectedMessage.from }],
      subject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      replyToMessageId: selectedMessage.id,
      inReplyTo: selectedMessage.messageId,
      references: selectedMessage.references
        ? `${selectedMessage.references} ${selectedMessage.messageId}`
        : selectedMessage.messageId,
      bodyHtml: `<br /><br /><blockquote>On ${selectedMessage.date}, ${selectedMessage.from} wrote:<br />${selectedMessage.bodyHtml || selectedMessage.bodyText || ""}</blockquote>`,
    });
  };

  const handleReplyAll = () => {
    const toRecipients = [{ address: selectedMessage.from }];
    const ccRecipients = (selectedMessage.to || []).filter(
      (r) => r.address !== selectedMessage.accountEmail
    );

    openCompose({
      accountId: selectedMessage.accountId,
      to: toRecipients,
      cc: ccRecipients,
      subject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      replyToMessageId: selectedMessage.id,
      inReplyTo: selectedMessage.messageId,
      references: selectedMessage.references
        ? `${selectedMessage.references} ${selectedMessage.messageId}`
        : selectedMessage.messageId,
      bodyHtml: `<br /><br /><blockquote>On ${selectedMessage.date}, ${selectedMessage.from} wrote:<br />${selectedMessage.bodyHtml || selectedMessage.bodyText || ""}</blockquote>`,
    });
  };

  const handleForward = () => {
    openCompose({
      accountId: selectedMessage.accountId,
      subject: selectedMessage.subject.startsWith("Fwd:")
        ? selectedMessage.subject
        : `Fwd: ${selectedMessage.subject}`,
      bodyHtml: `<br /><br />---------- Forwarded message ---------<br />From: ${selectedMessage.from}<br />Date: ${selectedMessage.date}<br />Subject: ${selectedMessage.subject}<br />To: ${JSON.stringify(selectedMessage.to)}<br /><br />${selectedMessage.bodyHtml || selectedMessage.bodyText || ""}`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Folders available to move to in this account
  const accountFolders = folders.filter(
    (f) => f.accountId === selectedMessage.accountId && f.id !== selectedMessage.folderId
  );

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-text"
      style={{ backgroundColor: "var(--theme-bg-surface)" }}
    >
      {/* Top Action Toolbar */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReply}
            title="Reply"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:bg-[var(--theme-fill-hover)]"
            style={{
              borderColor: "var(--theme-border)",
              color: "var(--theme-text)",
            }}
          >
            <Reply size={14} />
            <span>Reply</span>
          </button>

          <button
            onClick={handleReplyAll}
            title="Reply all"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:bg-[var(--theme-fill-hover)]"
            style={{
              borderColor: "var(--theme-border)",
              color: "var(--theme-text)",
            }}
          >
            <ReplyAll size={14} />
            <span>Reply all</span>
          </button>

          <button
            onClick={handleForward}
            title="Forward"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:bg-[var(--theme-fill-hover)]"
            style={{
              borderColor: "var(--theme-border)",
              color: "var(--theme-text)",
            }}
          >
            <Forward size={14} />
            <span>Forward</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {accountFolders.length > 0 && (
            <select
              aria-label="Move message to folder"
              onChange={(e) => {
                if (e.target.value) {
                  moveMessage(selectedMessage.id, e.target.value);
                }
              }}
              defaultValue=""
              className="px-2 py-1.5 rounded-lg text-xs border bg-transparent text-[var(--theme-text)] focus:outline-hidden"
              style={{ borderColor: "var(--theme-border)" }}
            >
              <option value="" disabled>
                Move to...
              </option>
              {accountFolders.map((f) => (
                <option key={f.id} value={f.id} className="bg-[var(--theme-bg-app)]">
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => toggleStar(selectedMessage.id, !selectedMessage.isStarred)}
            title={selectedMessage.isStarred ? "Unstar" : "Star"}
            className={`p-2 rounded-lg transition hover:bg-[var(--theme-fill-hover)] ${
              selectedMessage.isStarred
                ? "text-amber-400"
                : "text-[var(--theme-text-muted)] hover:text-amber-400"
            }`}
          >
            <Star
              size={15}
              fill={selectedMessage.isStarred ? "currentColor" : "none"}
            />
          </button>

          <button
            onClick={() => toggleRead(selectedMessage.id, false)}
            title="Mark as unread"
            className="p-2 rounded-lg transition hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
          >
            <Mail size={15} />
          </button>

          <button
            onClick={() => deleteMessage(selectedMessage.id)}
            title="Delete"
            className="p-2 rounded-lg transition hover:bg-red-500/10 text-[var(--theme-text-muted)] hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Message Header */}
      <div
        className="px-6 py-4 border-b shrink-0 flex flex-col gap-2"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            className="text-base font-bold text-[var(--theme-text)] leading-snug break-words"
          >
            {selectedMessage.subject || "(No subject)"}
          </h2>

          {selectedMessage.accountEmail && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border shrink-0"
              style={{
                borderColor: "var(--theme-border)",
                color: "var(--theme-text-muted)",
              }}
            >
              {selectedMessage.accountEmail}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase"
              style={{
                backgroundColor: "var(--theme-selected)",
                color: "var(--theme-primary)",
              }}
            >
              {selectedMessage.from[0] || "?"}
            </div>
            <div>
              <div className="font-semibold text-[var(--theme-text)]">
                {selectedMessage.from}
              </div>
              <div className="text-[11px] text-[var(--theme-text-muted)]">
                to {selectedMessage.to?.map((t: any) => t.address || t).join(", ")}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[var(--theme-text-muted)]">
            {format(new Date(selectedMessage.date), "PPP 'at' p")}
          </div>
        </div>

        {selectedMessage.cc && selectedMessage.cc.length > 0 && (
          <div className="text-[11px] text-[var(--theme-text-muted)] pl-10">
            cc: {selectedMessage.cc.map((c: any) => c.address || c).join(", ")}
          </div>
        )}
      </div>

      {/* Attachments Section if present */}
      {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
        <div
          className="px-6 py-2.5 border-b shrink-0 flex flex-wrap items-center gap-2"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-bg-app)",
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-text-muted)] mr-2">
            <Paperclip size={13} />
            <span>
              {selectedMessage.attachments.length}{" "}
              {selectedMessage.attachments.length === 1 ? "Attachment" : "Attachments"}:
            </span>
          </div>

          {selectedMessage.attachments.map((att) => (
            <a
              key={att.id}
              href={`/api/mail/attachments/${att.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-selected)] group"
              style={{
                borderColor: "var(--theme-border)",
                color: "var(--theme-text)",
              }}
            >
              <span className="font-medium truncate max-w-[180px]">
                {att.filename}
              </span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">
                ({formatFileSize(att.size)})
              </span>
              <Download
                size={12}
                className="text-[var(--theme-text-muted)] group-hover:text-blue-400"
              />
            </a>
          ))}
        </div>
      )}

      {/* Sandboxed HTML Email Body */}
      <div className="flex-1 overflow-y-auto">
        <SandboxedMailViewer
          htmlContent={selectedMessage.bodyHtml}
          textContent={selectedMessage.bodyText}
        />
      </div>
    </div>
  );
};
