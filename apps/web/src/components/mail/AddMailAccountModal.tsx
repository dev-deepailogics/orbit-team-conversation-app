"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
} from "lucide-react";
import { useMailStore } from "@/stores/mailStore";
import { api } from "@/lib/api";

export const AddMailAccountModal: React.FC = () => {
  const { showAddAccountModal, closeAddAccount, fetchAccounts } = useMailStore();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showManualSettings, setShowManualSettings] = useState(false);

  // Manual configuration inputs
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapSecurity, setImapSecurity] = useState<"SSL" | "STARTTLS" | "NONE">("SSL");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecurity, setSmtpSecurity] = useState<"SSL" | "STARTTLS" | "NONE">("SSL");

  // Status indicators
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    imapOk: boolean;
    smtpOk: boolean;
    error?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!showAddAccountModal) return null;

  // Auto-fill presets on email change
  const handleEmailChange = (val: string) => {
    setEmail(val);
    const domain = val.split("@")[1]?.toLowerCase();
    if (domain === "gmail.com" || domain === "googlemail.com") {
      setImapHost("imap.gmail.com");
      setImapPort(993);
      setImapSecurity("SSL");
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(465);
      setSmtpSecurity("SSL");
    } else if (
      domain === "outlook.com" ||
      domain === "hotmail.com" ||
      domain === "live.com" ||
      domain === "office365.com"
    ) {
      setImapHost("outlook.office365.com");
      setImapPort(993);
      setImapSecurity("SSL");
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
      setSmtpSecurity("STARTTLS");
    } else if (domain === "yahoo.com" || domain === "ymail.com") {
      setImapHost("imap.mail.yahoo.com");
      setImapPort(993);
      setImapSecurity("SSL");
      setSmtpHost("smtp.mail.yahoo.com");
      setSmtpPort(465);
      setSmtpSecurity("SSL");
    } else if (domain === "zoho.com") {
      setImapHost("imappro.zoho.com");
      setImapPort(993);
      setImapSecurity("SSL");
      setSmtpHost("smtppro.zoho.com");
      setSmtpPort(465);
      setSmtpSecurity("SSL");
    }
  };

  const handleTestConnection = async () => {
    if (!email || !password) {
      setErrorMessage("Please enter both email and password / app password.");
      return;
    }

    setIsTesting(true);
    setErrorMessage(null);
    setTestResult(null);

    try {
      const res = await api.post("/api/mail/accounts/test", {
        email,
        password,
        authType: "PASSWORD",
        provider: "CUSTOM",
        imapHost: imapHost || undefined,
        imapPort: Number(imapPort),
        imapSecurity,
        smtpHost: smtpHost || undefined,
        smtpPort: Number(smtpPort),
        smtpSecurity,
      });

      setTestResult({
        tested: true,
        imapOk: res.data.imapOk,
        smtpOk: res.data.smtpOk,
        error: res.data.error,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        imapOk: false,
        smtpOk: false,
        error: err.response?.data?.error || err.message || "Connection test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await api.post("/api/mail/accounts", {
        email,
        displayName: displayName || email.split("@")[0],
        password,
        authType: "PASSWORD",
        provider: "CUSTOM",
        imapHost: imapHost || undefined,
        imapPort: Number(imapPort),
        imapSecurity,
        smtpHost: smtpHost || undefined,
        smtpPort: Number(smtpPort),
        smtpSecurity,
      });

      await fetchAccounts();
      closeAddAccount();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to save account"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-2xl border flex flex-col shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--theme-bg-surface)",
          borderColor: "var(--theme-border)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <div className="flex items-center gap-2">
            <Mail className="text-blue-400" size={18} />
            <h3 className="font-bold text-sm text-[var(--theme-text)]">
              Connect Email Account
            </h3>
          </div>
          <button
            onClick={closeAddAccount}
            className="p-1 rounded-lg hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {testResult?.tested && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.imapOk && testResult.smtpOk
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {testResult.imapOk && testResult.smtpOk ? (
                <>
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-bold">Connection successful!</span>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Both IMAP receiving and SMTP sending server connections verified.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="font-bold">Connection failed:</span>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {testResult.error || "Could not verify IMAP or SMTP server."}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Email input */}
          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@company.com or you@gmail.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
              Your Name (Display Name)
            </label>
            <input
              type="text"
              placeholder="e.g. Sarah Connor"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Password / App Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--theme-text)]">
                Password or App Password
              </label>
              <span className="text-[10px] text-[var(--theme-text-muted)]">
                Stored with AES-256-GCM encryption
              </span>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl px-3 py-2 text-xs text-[var(--theme-text)] focus:outline-hidden focus:border-blue-500"
            />
            <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">
              For Gmail and Yahoo accounts with 2FA, generate an <strong>App Password</strong> in your Google or Yahoo account security settings.
            </p>
          </div>

          {/* Manual Settings Accordion */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManualSettings(!showManualSettings)}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline font-medium"
            >
              <Settings size={13} />
              <span>{showManualSettings ? "Hide server settings" : "Custom server settings (IMAP / SMTP)"}</span>
            </button>

            {showManualSettings && (
              <div className="mt-3 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-app)] space-y-3 animate-in fade-in">
                <div className="text-[11px] font-bold text-[var(--theme-text)]">
                  Incoming Mail (IMAP)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-[var(--theme-text-muted)] mb-0.5">
                      Host
                    </label>
                    <input
                      type="text"
                      placeholder="imap.example.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--theme-text-muted)] mb-0.5">
                      Port
                    </label>
                    <input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(Number(e.target.value))}
                      className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text)]"
                    />
                  </div>
                </div>

                <div className="text-[11px] font-bold text-[var(--theme-text)] pt-1">
                  Outgoing Mail (SMTP)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-[var(--theme-text-muted)] mb-0.5">
                      Host
                    </label>
                    <input
                      type="text"
                      placeholder="smtp.example.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--theme-text-muted)] mb-0.5">
                      Port
                    </label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--theme-text)]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--theme-border)]">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !email || !password}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-fill-hover)] transition disabled:opacity-50"
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeAddAccount}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !email || !password}
                className="px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:brightness-110 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-text, #ffffff)",
                }}
              >
                {isSaving ? "Connecting..." : "Save Account"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
