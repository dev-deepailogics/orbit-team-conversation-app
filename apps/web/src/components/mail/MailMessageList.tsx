"use client";

import React, { useState } from "react";
import {
  Search,
  Star,
  Paperclip,
  CheckSquare,
  Square,
  Trash2,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useMailStore } from "@/stores/mailStore";
import { formatDistanceToNow, format, isToday, isThisYear } from "date-fns";

export const MailMessageList: React.FC = () => {
  const {
    messages,
    selectedMessage,
    totalMessages,
    page,
    limit,
    isLoadingMessages,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    fetchMessages,
    fetchMessageDetail,
    toggleStar,
    bulkAction,
  } = useMailStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Toggle individual message selection for bulk actions
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all on current page
  const toggleSelectAll = () => {
    if (selectedIds.length === messages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(messages.map((m) => m.id));
    }
  };

  // Handle bulk action and clear selection
  const handleBulk = async (action: "read" | "unread" | "star" | "delete") => {
    if (selectedIds.length === 0) return;
    await bulkAction(action, selectedIds);
    setSelectedIds([]);
  };

  // Format message date cleanly
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isToday(d)) {
        return format(d, "h:mm a");
      }
      if (isThisYear(d)) {
        return format(d, "MMM d");
      }
      return format(d, "MM/dd/yy");
    } catch {
      return "";
    }
  };

  const totalPages = Math.ceil(totalMessages / limit) || 1;

  return (
    <div
      className="w-96 border-r flex flex-col h-full shrink-0 select-none"
      style={{
        backgroundColor: "var(--theme-bg-app)",
        borderColor: "var(--theme-border)",
      }}
    >
      {/* Top Search Bar */}
      <div
        className="p-3 border-b flex flex-col gap-2"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
          style={{
            backgroundColor: "var(--theme-bg-surface)",
            borderColor: "var(--theme-border)",
            color: "var(--theme-text)",
          }}
        >
          <Search size={14} className="text-[var(--theme-text-muted)] shrink-0" />
          <input
            type="text"
            placeholder="Search mail (subject, from, body)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 focus:outline-hidden placeholder:text-[var(--theme-text-muted)] text-xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "starred", label: "Starred" },
              { id: "attachments", label: "Files" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0"
              style={{
                backgroundColor:
                  filter === item.id
                    ? "var(--theme-selected)"
                    : "transparent",
                color:
                  filter === item.id
                    ? "var(--theme-text)"
                    : "var(--theme-text-muted)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar / Selection Header */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between text-xs"
        style={{
          borderColor: "var(--theme-border)",
          backgroundColor: selectedIds.length > 0 ? "var(--theme-selected)" : "transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
          >
            {selectedIds.length > 0 && selectedIds.length === messages.length ? (
              <CheckSquare size={15} className="text-blue-400" />
            ) : (
              <Square size={15} />
            )}
          </button>
          <span className="text-[11px] text-[var(--theme-text-muted)]">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${totalMessages} messages`}
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-1 animate-in fade-in">
            <button
              onClick={() => handleBulk("read")}
              title="Mark as read"
              className="p-1 rounded-md hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
            >
              <MailOpen size={14} />
            </button>
            <button
              onClick={() => handleBulk("unread")}
              title="Mark as unread"
              className="p-1 rounded-md hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
            >
              <Mail size={14} />
            </button>
            <button
              onClick={() => handleBulk("star")}
              title="Star"
              className="p-1 rounded-md hover:bg-[var(--theme-fill-hover)] text-[var(--theme-text-muted)] hover:text-amber-400"
            >
              <Star size={14} />
            </button>
            <button
              onClick={() => handleBulk("delete")}
              title="Delete"
              className="p-1 rounded-md hover:bg-red-500/10 text-[var(--theme-text-muted)] hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--theme-border)]">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--theme-text-muted)]">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--theme-text-muted)]">
            <Mail size={28} className="mb-2 opacity-40" />
            <span className="font-semibold text-sm mb-1 text-[var(--theme-text)]">
              No messages found
            </span>
            <span>Your folder is empty or matches no filters.</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedMessage?.id === msg.id;
            const isChecked = selectedIds.includes(msg.id);

            return (
              <div
                key={msg.id}
                onClick={() => fetchMessageDetail(msg.id)}
                className="group relative p-3 cursor-pointer transition flex items-start gap-2.5"
                style={{
                  backgroundColor: isSelected
                    ? "var(--theme-selected)"
                    : isChecked
                    ? "var(--theme-fill-hover)"
                    : "transparent",
                }}
              >
                {/* Checkbox & Star Bar */}
                <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
                  <button
                    onClick={(e) => toggleSelect(msg.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ opacity: isChecked ? 1 : undefined }}
                  >
                    {isChecked ? (
                      <CheckSquare size={13} className="text-blue-400" />
                    ) : (
                      <Square size={13} className="text-[var(--theme-text-muted)]" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(msg.id, !msg.isStarred);
                    }}
                    className={`transition-colors ${
                      msg.isStarred
                        ? "text-amber-400"
                        : "text-[var(--theme-text-muted)] hover:text-amber-400"
                    }`}
                  >
                    <Star
                      size={13}
                      fill={msg.isStarred ? "currentColor" : "none"}
                    />
                  </button>
                </div>

                {/* Message Body Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-xs truncate ${
                        !msg.isRead ? "font-bold text-[var(--theme-text)]" : "font-medium text-[var(--theme-text-muted)]"
                      }`}
                    >
                      {msg.from}
                    </span>
                    <span className="text-[10px] text-[var(--theme-text-muted)] shrink-0">
                      {formatDate(msg.date)}
                    </span>
                  </div>

                  <div
                    className={`text-xs truncate mb-1 ${
                      !msg.isRead ? "font-semibold text-[var(--theme-text)]" : "text-[var(--theme-text)]"
                    }`}
                  >
                    {msg.subject || "(No subject)"}
                  </div>

                  <div className="text-[11px] text-[var(--theme-text-muted)] line-clamp-1 break-words">
                    {msg.snippet || "No preview available"}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    {msg.hasAttachments && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)]">
                        <Paperclip size={11} />
                        <span>Attachment</span>
                      </span>
                    )}
                    {msg.accountEmail && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--theme-bg-surface)] text-[var(--theme-text-muted)] truncate max-w-[140px]">
                        {msg.accountEmail}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {!msg.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          className="p-2.5 border-t flex items-center justify-between text-xs"
          style={{
            borderColor: "var(--theme-border)",
            color: "var(--theme-text-muted)",
          }}
        >
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchMessages(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoadingMessages}
              className="p-1 rounded hover:bg-[var(--theme-fill-hover)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => fetchMessages(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isLoadingMessages}
              className="p-1 rounded hover:bg-[var(--theme-fill-hover)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
