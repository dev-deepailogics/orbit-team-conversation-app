'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Pin,
  PinOff,
  ArrowRight,
  MessageSquare,
  Paperclip,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Channel, Message, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { MarkdownRenderer } from './MarkdownRenderer';

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  currentUser: UserProfile | null;
  onJumpToMessage: (message: Message) => void;
}

export const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  isOpen,
  onClose,
  channel,
  currentUser,
  onJumpToMessage,
}) => {
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && channel) {
      setIsLoading(true);
      api
        .get(`/api/channels/${channel.id}/pins`)
        .then((res) => {
          setPinnedMessages(res.data || []);
        })
        .catch((err) => {
          console.error('Failed to load pinned messages', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setPinnedMessages([]);
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  const handleUnpin = async (msg: any) => {
    setUnpinningId(msg.id);
    try {
      const res = await api.post(`/api/messages/${msg.id}/pin`, { isPinned: false });
      setPinnedMessages((prev) => prev.filter((m) => m.id !== msg.id));
      useChatStore.getState().updateMessage(res.data.message);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to unpin message');
    } finally {
      setUnpinningId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--theme-border)] bg-[var(--theme-bg-app)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Pin size={18} className="fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--theme-text)] flex items-center gap-2">
                <span>Pinned Messages</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/40">
                  {pinnedMessages.length}
                </span>
              </h2>
              <p className="text-xs text-[var(--theme-text-muted)]">#{channel.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] rounded-lg transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
              <Loader2 className="w-7 h-7 text-amber-600 dark:text-amber-400 animate-spin mb-2" />
              <p className="text-xs">Loading pinned messages...</p>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
              <div className="w-12 h-12 rounded-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] flex items-center justify-center mb-3 text-amber-600 dark:text-amber-400/80">
                <Pin size={22} />
              </div>
              <h3 className="text-[var(--theme-text)] font-semibold text-sm mb-1">No pinned messages</h3>
              <p className="text-xs text-[var(--theme-text-muted)] max-w-sm">
                Keep important announcements, docs, and notes accessible for everyone in #{channel.name}. Hover over any message and click the Pin icon to pin it here.
              </p>
            </div>
          ) : (
            pinnedMessages.map((msg) => {
              const authorName = msg.bot?.name || msg.user?.displayName || msg.user?.username || 'Unknown';
              const avatarUrl =
                msg.bot?.avatarUrl ||
                msg.user?.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`;

              return (
                <div
                  key={msg.id}
                  className="bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border border-amber-500/30 rounded-xl p-3.5 transition flex flex-col gap-2.5"
                >
                  {/* Top Bar: Author, Time */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={avatarUrl}
                        alt={authorName}
                        className="w-7 h-7 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--theme-text)] text-xs truncate block">
                          {authorName}
                        </span>
                        <span className="text-[11px] text-[var(--theme-text-muted)]">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleUnpin(msg)}
                        disabled={unpinningId === msg.id}
                        title="Unpin message"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--theme-bg-surface)] hover:bg-red-900/30 text-[var(--theme-text-muted)] hover:text-red-400 border border-[var(--theme-border)] text-xs transition"
                      >
                        {unpinningId === msg.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <PinOff size={12} />
                        )}
                        <span className="hidden sm:inline">Unpin</span>
                      </button>

                      <button
                        onClick={() => {
                          onJumpToMessage(msg);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-semibold transition"
                      >
                        <span>Jump to</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="text-xs sm:text-sm text-[var(--theme-text)] break-words leading-relaxed pl-1">
                    <MarkdownRenderer content={msg.content} />
                  </div>

                  {/* Attachments if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2 text-[11px] text-[var(--theme-text-muted)]">
                      {msg.attachments.map((att: any) => (
                        <span
                          key={att.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                        >
                          <Paperclip size={11} className="text-amber-600 dark:text-amber-400" />
                          <span className="truncate max-w-xs">{att.fileName}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
