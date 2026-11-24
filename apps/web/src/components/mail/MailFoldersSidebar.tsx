"use client";

import React, { useState } from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Archive,
  Star,
  Folder,
  Plus,
  RefreshCw,
  Edit,
  ChevronDown,
  ChevronRight,
  Mail,
} from "lucide-react";
import { useMailStore } from "@/stores/mailStore";
import { MailFolderSpecialUse } from "@orbit/types";

export const MailFoldersSidebar: React.FC = () => {
  const {
    accounts,
    activeAccountId,
    folders,
    activeFolderId,
    activeSpecialUse,
    isSyncing,
    selectAccountFolder,
    triggerSync,
    deleteAccount,
    openCompose,
    openAddAccount,
  } = useMailStore();

  // Collapsed state per account (default: all expanded)
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});
  const [accountToDelete, setAccountToDelete] = useState<any | null>(null);

  const toggleAccountCollapse = (accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedAccounts((prev) => ({
      ...prev,
      [accId]: !prev[accId],
    }));
  };

  const standardNavItems: {
    specialUse: MailFolderSpecialUse;
    label: string;
    icon: React.ElementType;
  }[] = [
    { specialUse: "INBOX", label: "Inbox", icon: Inbox },
    { specialUse: "STARRED", label: "Starred", icon: Star },
    { specialUse: "SENT", label: "Sent", icon: Send },
    { specialUse: "DRAFTS", label: "Drafts", icon: FileText },
    { specialUse: "ARCHIVE", label: "Archive", icon: Archive },
    { specialUse: "SPAM", label: "Spam", icon: AlertOctagon },
    { specialUse: "TRASH", label: "Trash", icon: Trash2 },
  ];

  // Calculate total unread across all accounts
  const totalAllInboxesUnread = accounts.reduce(
    (sum, acc) => sum + (acc.unreadCount || 0),
    0
  );

  return (
    <div
      className="w-64 border-r flex flex-col h-full select-none shrink-0"
      style={{
        backgroundColor: "var(--theme-bg-surface)",
        borderColor: "var(--theme-border)",
      }}
    >
      {/* 1. Header with Sync & Add Account */}
      <div
        className="p-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-blue-400" />
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: "var(--theme-text)" }}
          >
            Mail
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => triggerSync()}
            disabled={isSyncing}
            title="Sync all accounts"
            className="p-1.5 rounded-lg hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={isSyncing ? "animate-spin text-blue-400" : ""}
            />
          </button>

          <button
            onClick={openAddAccount}
            title="Add email account"
            className="p-1.5 rounded-lg hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* 2. Compose New Message Button */}
      <div className="p-3 shrink-0">
        <button
          onClick={() => openCompose()}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-semibold text-xs transition shadow-sm hover:brightness-110"
          style={{
            backgroundColor: "var(--theme-primary)",
            color: "var(--theme-primary-text, #ffffff)",
          }}
        >
          <Edit size={14} />
          <span>New message</span>
        </button>
      </div>

      {/* 3. Accounts & Folders Tree */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4">
        {/* Unified All Inboxes option */}
        <div>
          <button
            onClick={() => selectAccountFolder(null, null, "INBOX")}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition"
            style={{
              backgroundColor:
                activeAccountId === null && activeSpecialUse === "INBOX"
                  ? "var(--theme-selected)"
                  : "transparent",
              color:
                activeAccountId === null && activeSpecialUse === "INBOX"
                  ? "var(--theme-text)"
                  : "var(--theme-text-muted)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Mail
                size={14}
                className={
                  activeAccountId === null && activeSpecialUse === "INBOX"
                    ? "text-blue-400"
                    : ""
                }
              />
              <span className="font-semibold">All Inboxes</span>
            </div>
            {totalAllInboxesUnread > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "#ffffff",
                }}
              >
                {totalAllInboxesUnread}
              </span>
            )}
          </button>
        </div>

        {/* List of Accounts with nested folders */}
        {accounts.map((account) => {
          const isCollapsed = !!collapsedAccounts[account.id];
          const accountFolders = folders.filter((f) => f.accountId === account.id);
          const customFolders = accountFolders.filter(
            (f) => f.specialUse === "CUSTOM" || !f.specialUse
          );

          return (
            <div key={account.id} className="space-y-0.5">
              {/* Account Header Row */}
              <div
                onClick={(e) => toggleAccountCollapse(account.id, e)}
                className="group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-[var(--theme-fill-hover)] transition"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]">
                    {isCollapsed ? (
                      <ChevronRight size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </span>
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 font-bold text-[10px] uppercase"
                    style={{
                      backgroundColor: "var(--theme-selected)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    {account.displayName?.[0] || account.email[0]}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-xs font-semibold truncate leading-tight"
                      style={{ color: "var(--theme-text)" }}
                    >
                      {account.displayName || account.email.split("@")[0]}
                    </span>
                    <span
                      className="text-[10px] truncate leading-tight opacity-70"
                      style={{ color: "var(--theme-text-muted)" }}
                    >
                      {account.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerSync(account.id);
                    }}
                    title="Sync this account"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--theme-selected)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
                  >
                    <RefreshCw size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountToDelete(account);
                    }}
                    title="Remove this account"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[var(--theme-text-muted)] hover:text-red-400 transition"
                  >
                    <Trash2 size={11} />
                  </button>
                  {(account.unreadCount || 0) > 0 && (
                    <span
                      className="px-1.5 py-0.2 rounded-full text-[9px] font-bold"
                      style={{
                        backgroundColor: "var(--theme-primary)",
                        color: "#ffffff",
                      }}
                    >
                      {account.unreadCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Nested Folders for this Account */}
              {!isCollapsed && (
                <div className="pl-4 space-y-0.5 border-l ml-3 border-[var(--theme-border)]">
                  {standardNavItems.map(({ specialUse, label, icon: Icon }) => {
                    const matchingFolder = accountFolders.find(
                      (f) => f.specialUse === specialUse
                    );
                    const isSelected =
                      activeAccountId === account.id &&
                      (matchingFolder
                        ? activeFolderId === matchingFolder.id
                        : activeSpecialUse === specialUse);

                    const unread = matchingFolder?.unreadCount || 0;

                    return (
                      <button
                        key={specialUse}
                        onClick={() =>
                          selectAccountFolder(
                            account.id,
                            matchingFolder?.id || null,
                            specialUse
                          )
                        }
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition group"
                        style={{
                          backgroundColor: isSelected
                            ? "var(--theme-selected)"
                            : "transparent",
                          color: isSelected
                            ? "var(--theme-text)"
                            : "var(--theme-text-muted)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            size={13}
                            className={isSelected ? "text-blue-400" : ""}
                          />
                          <span
                            className={
                              isSelected ? "font-semibold" : "font-normal"
                            }
                          >
                            {label}
                          </span>
                        </div>
                        {unread > 0 && (
                          <span
                            className="px-1.5 py-0.2 rounded-full text-[9px] font-bold"
                            style={{
                              backgroundColor: "var(--theme-primary)",
                              color: "#ffffff",
                            }}
                          >
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Custom IMAP folders for this account */}
                  {customFolders.length > 0 && (
                    <>
                      <div
                        className="px-2 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60"
                        style={{ color: "var(--theme-text-muted)" }}
                      >
                        Labels & Folders
                      </div>
                      {customFolders.map((folder) => {
                        const isSelected =
                          activeAccountId === account.id &&
                          activeFolderId === folder.id;

                        return (
                          <button
                            key={folder.id}
                            onClick={() =>
                              selectAccountFolder(account.id, folder.id, null)
                            }
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition group"
                            style={{
                              backgroundColor: isSelected
                                ? "var(--theme-selected)"
                                : "transparent",
                              color: isSelected
                                ? "var(--theme-text)"
                                : "var(--theme-text-muted)",
                            }}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Folder
                                size={13}
                                className={isSelected ? "text-blue-400" : ""}
                              />
                              <span className="truncate">{folder.name}</span>
                            </div>
                            {(folder.unreadCount || 0) > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-full text-[9px] font-bold"
                                style={{
                                  backgroundColor: "var(--theme-primary)",
                                  color: "#ffffff",
                                }}
                              >
                                {folder.unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="p-4 text-center text-xs text-[var(--theme-text-muted)] space-y-2">
            <Mail size={24} className="mx-auto opacity-40" />
            <p>No email accounts connected yet.</p>
            <button
              onClick={openAddAccount}
              className="text-blue-400 font-semibold hover:underline"
            >
              + Connect account
            </button>
          </div>
        )}
      </div>

      {/* 4. Footer with Account Count & Quick Add */}
      <div
        className="p-3 border-t text-[11px] flex items-center justify-between shrink-0"
        style={{
          borderColor: "var(--theme-border)",
          color: "var(--theme-text-muted)",
        }}
      >
        <span>
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
        </span>
        <button
          onClick={openAddAccount}
          className="hover:underline flex items-center gap-1 text-blue-400 font-medium"
        >
          <Plus size={12} />
          <span>Add account</span>
        </button>
      </div>

      {/* Remove Account Confirmation Dialog */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl flex flex-col gap-3"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
            }}
          >
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <Trash2 size={16} />
              <span>Remove Email Account</span>
            </div>
            <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-[var(--theme-text)]">
                {accountToDelete.displayName || accountToDelete.email}
              </strong>{" "}
              ({accountToDelete.email})? This will delete the account and all of its
              synced emails from your database.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = accountToDelete.id;
                  setAccountToDelete(null);
                  await deleteAccount(id);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition shadow-sm"
              >
                Remove Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
