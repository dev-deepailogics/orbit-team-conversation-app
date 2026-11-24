"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Trash2,
  Paperclip,
  ChevronDown,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useMailStore } from "@/stores/mailStore";
import { api } from "@/lib/api";

export const MailComposeModal: React.FC = () => {
  const {
    showComposeModal,
    composeDraft,
    accounts,
    activeAccountId,
    closeCompose,
    fetchMessages,
  } = useMailStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize draft inputs
  useEffect(() => {
    if (showComposeModal) {
      const defaultAccount =
        activeAccountId || (accounts.length > 0 ? accounts[0].id : "");
      setSelectedAccountId(composeDraft?.accountId || defaultAccount);

      if (composeDraft?.to) {
        const toList = Array.isArray(composeDraft.to)
          ? composeDraft.to.map((r: any) => (typeof r === "string" ? r : r.address)).join(", ")
          : "";
        setToInput(toList);
      } else {
        setToInput("");
      }

      if (composeDraft?.cc) {
        const ccList = Array.isArray(composeDraft.cc)
          ? composeDraft.cc.map((r: any) => (typeof r === "string" ? r : r.address)).join(", ")
          : "";
        setCcInput(ccList);
        setShowCc(true);
      } else {
        setCcInput("");
        setShowCc(false);
      }

      setSubject(composeDraft?.subject || "");
      setBodyText(composeDraft?.bodyText || "");
      setDraftId(composeDraft?.draftId);
      setErrorMessage(null);
    }
  }, [showComposeModal, composeDraft, activeAccountId, accounts]);

  // Autosave draft every 15 seconds
  useEffect(() => {
    if (!showComposeModal || !selectedAccountId) return;
    if (!toInput && !subject && !bodyText) return;

    const interval = setInterval(async () => {
      try {
        setIsSavingDraft(true);
        const toArray = toInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const res = await api.post("/api/mail/drafts", {
          accountId: selectedAccountId,
          to: toArray,
          subject,
          bodyText,
          draftId,
        });

        if (res.data?.draftId) {
          setDraftId(res.data.draftId);
        }
      } catch {
        // Silently fail autosave
      } finally {
        setIsSavingDraft(false);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [showComposeModal, selectedAccountId, toInput, subject, bodyText, draftId]);

  if (!showComposeModal) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setErrorMessage("Please select an email account to send from.");
      return;
    }

    const toArray = toInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (toArray.length === 0) {
      setErrorMessage("Please specify at least one recipient in 'To'.");
      return;
    }

    const ccArray = ccInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const bccArray = bccInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSending(true);
    setErrorMessage(null);

    try {
      await api.post("/api/mail/send", {
        accountId: selectedAccountId,
        to: toArray,
        cc: ccArray.length > 0 ? ccArray : undefined,
        bcc: bccArray.length > 0 ? bccArray : undefined,
        subject,
        bodyText,
        bodyHtml: bodyText.replace(/\n/g, "<br />"),
        inReplyTo: composeDraft?.inReplyTo,
        references: composeDraft?.references,
        replyToMessageId: composeDraft?.replyToMessageId,
        draftId,
      });

      closeCompose();
      fetchMessages();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || "Failed to send email"
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border flex flex-col shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--theme-bg-surface)",
          borderColor: "var(--theme-border)",
          height: "640px",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[var(--theme-text)]">
              New Message
            </span>
            {isSavingDraft && (
              <span className="text-[10px] text-[var(--theme-text-muted)] animate-pulse">
                Saving draft...
              </span>
            )}
          </div>
          <button
            onClick={closeCompose}
            className="p-1 rounded-lg hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Compose Form */}
        <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden">
          {errorMessage && (
            <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Account Selector ("From") */}
          <div
            className="px-5 py-2.5 border-b flex items-center text-xs"
            style={{ borderColor: "var(--theme-border)" }}
          >
            <span className="w-16 text-[var(--theme-text-muted)] font-medium">
              From:
            </span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 bg-transparent text-[var(--theme-text)] focus:outline-hidden text-xs"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-[var(--theme-bg-app)]">
                  {acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email}
                </option>
              ))}
            </select>
          </div>

          {/* To Field */}
          <div
            className="px-5 py-2.5 border-b flex items-center text-xs"
            style={{ borderColor: "var(--theme-border)" }}
          >
            <span className="w-16 text-[var(--theme-text-muted)] font-medium">
              To:
            </span>
            <input
              type="text"
              required
              placeholder="recipient@example.com (comma-separated)"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="flex-1 bg-transparent text-[var(--theme-text)] focus:outline-hidden placeholder:text-[var(--theme-text-muted)] text-xs"
            />
            <div className="flex items-center gap-1 text-[11px] text-[var(--theme-text-muted)] ml-2">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="hover:underline"
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="hover:underline ml-1"
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* Optional Cc Field */}
          {showCc && (
            <div
              className="px-5 py-2 border-b flex items-center text-xs"
              style={{ borderColor: "var(--theme-border)" }}
            >
              <span className="w-16 text-[var(--theme-text-muted)] font-medium">
                Cc:
              </span>
              <input
                type="text"
                placeholder="cc@example.com"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                className="flex-1 bg-transparent text-[var(--theme-text)] focus:outline-hidden placeholder:text-[var(--theme-text-muted)] text-xs"
              />
            </div>
          )}

          {/* Optional Bcc Field */}
          {showBcc && (
            <div
              className="px-5 py-2 border-b flex items-center text-xs"
              style={{ borderColor: "var(--theme-border)" }}
            >
              <span className="w-16 text-[var(--theme-text-muted)] font-medium">
                Bcc:
              </span>
              <input
                type="text"
                placeholder="bcc@example.com"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                className="flex-1 bg-transparent text-[var(--theme-text)] focus:outline-hidden placeholder:text-[var(--theme-text-muted)] text-xs"
              />
            </div>
          )}

          {/* Subject Field */}
          <div
            className="px-5 py-2.5 border-b flex items-center text-xs"
            style={{ borderColor: "var(--theme-border)" }}
          >
            <span className="w-16 text-[var(--theme-text-muted)] font-medium">
              Subject:
            </span>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-[var(--theme-text)] font-medium focus:outline-hidden placeholder:text-[var(--theme-text-muted)] text-xs"
            />
          </div>

          {/* Message Body Area */}
          <div className="flex-1 p-5 overflow-y-auto">
            <textarea
              placeholder="Write your email here..."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full h-full bg-transparent text-[var(--theme-text)] focus:outline-hidden resize-none text-xs leading-relaxed placeholder:text-[var(--theme-text-muted)]"
            />
          </div>

          {/* Bottom Toolbar & Send Button */}
          <div
            className="px-5 py-3.5 border-t flex items-center justify-between shrink-0"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--theme-bg-app)",
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:brightness-110 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-text, #ffffff)",
                }}
              >
                <Send size={13} className={isSending ? "animate-pulse" : ""} />
                <span>{isSending ? "Sending..." : "Send"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={closeCompose}
              title="Discard draft"
              className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--theme-text-muted)] hover:text-red-400 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
