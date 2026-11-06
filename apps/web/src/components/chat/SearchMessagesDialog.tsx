'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Hash,
  Lock,
  MessageSquare,
  FileText,
  Paperclip,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  CornerDownLeft,
  Sparkles,
  Eye,
  ArrowLeft,
  ExternalLink,
  Download,
} from 'lucide-react';
import { Workspace, Channel } from '@orbit/types';
import { api } from '../../lib/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FileAttachmentList } from './FileAttachmentList';

interface SearchMessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  currentChannel: Channel | null;
  channels: Channel[];
  members: any[];
  onSelectMessage: (message: any) => void;
}

export const SearchMessagesDialog: React.FC<SearchMessagesDialogProps> = ({
  isOpen,
  onClose,
  workspace,
  currentChannel,
  channels,
  members,
  onSelectMessage,
}) => {
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannel?.id || 'all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [hasAttachmentOnly, setHasAttachmentOnly] = useState<boolean>(false);
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedFullMessage, setSelectedFullMessage] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when dialog opens and default to current channel
  useEffect(() => {
    if (isOpen) {
      setSelectedChannelId(currentChannel?.id || 'all');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setResults([]);
      setTotal(0);
      setHasSearched(false);
      setSelectedChannelId(currentChannel?.id || 'all');
      setSelectedUserId('all');
      setHasAttachmentOnly(false);
      setSelectedFullMessage(null);
    }
  }, [isOpen, currentChannel]);

  // Handle ESC key to close or return from full message view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedFullMessage) {
          setSelectedFullMessage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFullMessage, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen || !workspace) return;

    const trimmedQuery = query.trim();
    const hasFilter = selectedUserId !== 'all' || hasAttachmentOnly;

    if (!trimmedQuery && !hasFilter) {
      setResults([]);
      setTotal(0);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const params: Record<string, string> = {
          workspaceId: workspace.id,
          limit: '30',
        };

        if (trimmedQuery) {
          params.q = trimmedQuery;
        }

        if (selectedChannelId !== 'all') {
          params.channelId = selectedChannelId;
        }

        if (selectedUserId !== 'all') {
          params.userId = selectedUserId;
        }

        if (hasAttachmentOnly) {
          params.hasAttachment = 'true';
        }

        const res = await api.get('/api/messages/search', { params });
        setResults(res.data.messages || []);
        setTotal(res.data.total || 0);
        setHasSearched(true);
      } catch (err) {
        console.error('Failed to search messages', err);
        setResults([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [query, selectedChannelId, selectedUserId, hasAttachmentOnly, isOpen, workspace]);

  if (!isOpen || !workspace) return null;

  // Highlight search term in text snippet
  const renderHighlightedContent = (text: string, term: string) => {
    if (!term.trim()) return text;

    const escapedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-slack-green/30 text-emerald-700 dark:text-emerald-300 font-semibold px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-3 sm:px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div className="relative w-full max-w-2xl bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* If viewing a single full message */}
        {selectedFullMessage ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Full Message View Header */}
            <div className="p-3.5 sm:p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-app)] flex items-center justify-between">
              <button
                onClick={() => setSelectedFullMessage(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--theme-text)] hover:text-[var(--theme-text)] bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] px-2.5 py-1.5 rounded-lg border border-[var(--theme-border)] transition"
              >
                <ArrowLeft size={14} />
                <span>Back to results</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSelectMessage(selectedFullMessage);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-slack-green hover:bg-[#008a65] text-white px-3 py-1.5 rounded-lg transition shadow"
                >
                  <span>Jump to Timeline</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Full Message Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Channel and Time Info */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-[var(--theme-border)]">
                <div className="flex items-center gap-1.5 font-medium text-[var(--theme-text)]">
                  {selectedFullMessage.channel?.type === 'DIRECT' ? (
                    <span className="text-slack-green font-bold text-xs">@</span>
                  ) : selectedFullMessage.channel?.type === 'PRIVATE' ? (
                    <Lock size={13} className="text-[var(--theme-text-muted)]" />
                  ) : (
                    <Hash size={14} className="text-[var(--theme-text-muted)]" />
                  )}
                  <span className="text-[var(--theme-text)] font-semibold">
                    {selectedFullMessage.channel?.name || 'channel'}
                  </span>
                  {selectedFullMessage.parentMessageId && (
                    <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-[var(--theme-bg-surface)] text-[10px] text-slack-green border border-[var(--theme-border)]">
                      <MessageSquare size={10} />
                      <span>Thread Reply</span>
                    </span>
                  )}
                </div>
                <span className="text-[var(--theme-text-muted)] text-xs">
                  {new Date(selectedFullMessage.createdAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              {/* Author Info */}
              <div className="flex items-center gap-3">
                <img
                  src={
                    selectedFullMessage.bot?.avatarUrl ||
                    selectedFullMessage.user?.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${
                      selectedFullMessage.bot?.name ||
                      selectedFullMessage.user?.displayName ||
                      'User'
                    }`
                  }
                  alt="Author"
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--theme-text)]">
                      {selectedFullMessage.bot?.name ||
                        selectedFullMessage.user?.displayName ||
                        selectedFullMessage.user?.username ||
                        'Teammate'}
                    </span>
                    {selectedFullMessage.bot && (
                      <span className="text-[10px] font-semibold bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] px-1.5 py-0.2 rounded uppercase">
                        APP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--theme-text-muted)]">
                    @{selectedFullMessage.user?.username || 'user'}
                  </span>
                </div>
              </div>

              {/* Message Content (Full Markdown) */}
              <div className="bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] rounded-xl p-4 text-sm text-[var(--theme-text)] break-words leading-relaxed">
                <MarkdownRenderer content={selectedFullMessage.content} />
              </div>

              {/* Attachments */}
              {selectedFullMessage.attachments && selectedFullMessage.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block">
                    Attachments ({selectedFullMessage.attachments.length})
                  </span>
                  <div className="space-y-2">
                    {selectedFullMessage.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Paperclip size={16} className="text-slack-green shrink-0" />
                          <span className="text-[var(--theme-text)] font-medium truncate">{att.fileName}</span>
                          <span className="text-[var(--theme-text-muted)] text-[11px] shrink-0">
                            ({Math.round(att.fileSize / 1024)} KB)
                          </span>
                        </div>
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={att.fileName}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--theme-bg-surface-hover)] hover:bg-[#454D54] text-white text-xs font-medium transition shrink-0 ml-3"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reactions list */}
              {selectedFullMessage.reactions && selectedFullMessage.reactions.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block mb-2">
                    Reactions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFullMessage.reactions.map((r: any) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)]"
                      >
                        <span>{r.emoji}</span>
                        <span className="text-[11px] text-[var(--theme-text-muted)]">{r.user?.displayName || '1'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full Message Footer Actions */}
            <div className="p-3 bg-[var(--theme-bg-app)] border-t border-[var(--theme-border)] flex items-center justify-between">
              <button
                onClick={() => setSelectedFullMessage(null)}
                className="px-3 py-1.5 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              >
                ← Back to search results
              </button>
              <button
                onClick={() => {
                  onSelectMessage(selectedFullMessage);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slack-green hover:bg-[#008a65] text-white transition flex items-center gap-1.5 shadow"
              >
                <span>Jump to Message in Timeline</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Search Mode */
          <>
            {/* Search Header Bar */}
            <div className="p-3 sm:p-4 border-b border-[var(--theme-border)] flex items-center gap-2.5 bg-[var(--theme-bg-app)]">
              <div className="relative flex-1 flex items-center">
                {isLoading ? (
                  <Loader2 className="absolute left-3 w-5 h-5 text-slack-green animate-spin pointer-events-none" />
                ) : (
                  <Search className="absolute left-3 w-5 h-5 text-[var(--theme-text-muted)] pointer-events-none" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    selectedChannelId !== 'all' && currentChannel?.id === selectedChannelId
                      ? `Search in #${currentChannel.name}...`
                      : `Search messages in ${workspace.name}...`
                  }
                  className="w-full bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] pl-10 pr-9 py-2.5 rounded-lg border border-[var(--theme-border)] focus:border-slack-green focus:outline-none focus:ring-1 focus:ring-slack-green text-sm placeholder:text-[var(--theme-text-muted)] transition"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] rounded-md transition"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] rounded-lg transition"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-3 sm:px-4 py-2 bg-[var(--theme-bg-surface)] border-b border-[var(--theme-border)] flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[var(--theme-text-muted)] shrink-0 font-medium">Filter by:</span>

              {/* Channel selector */}
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="bg-[var(--theme-bg-app)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-slack-green transition cursor-pointer"
              >
                {currentChannel && (
                  <option value={currentChannel.id}>
                    In: #{currentChannel.name} (Current)
                  </option>
                )}
                <option value="all">All Channels in {workspace.name}</option>
                {channels
                  .filter((c) => c.id !== currentChannel?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type === 'DIRECT' ? '@ ' : '# '}
                      {c.name}
                    </option>
                  ))}
              </select>

              {/* Member / Author selector */}
              {members && members.length > 0 && (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-[var(--theme-bg-app)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-slack-green transition cursor-pointer"
                >
                  <option value="all">From: Anyone</option>
                  {members.map((m) => {
                    const u = m.user || m;
                    return (
                      <option key={u.id} value={u.id}>
                        From: {u.displayName || u.username || u.email}
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Has attachments toggle */}
              <button
                onClick={() => setHasAttachmentOnly(!hasAttachmentOnly)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition shrink-0 ${
                  hasAttachmentOnly
                    ? 'bg-slack-green/20 border-slack-green text-slack-green font-medium'
                    : 'bg-[var(--theme-bg-app)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                <Paperclip size={12} />
                <span>Has files</span>
              </button>

              {(selectedChannelId !== 'all' || selectedUserId !== 'all' || hasAttachmentOnly) && (
                <button
                  onClick={() => {
                    setSelectedChannelId('all');
                    setSelectedUserId('all');
                    setHasAttachmentOnly(false);
                  }}
                  className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] underline text-[11px] ml-auto shrink-0"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Search Results / Content Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[220px]">
              {/* Initial State / Prompt */}
              {!hasSearched && !isLoading && (
                <div className="py-10 text-center flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
                  <div className="w-12 h-12 rounded-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] flex items-center justify-center mb-3 text-slack-green">
                    <Search size={22} />
                  </div>
                  <h3 className="text-[var(--theme-text)] font-semibold text-sm mb-1">
                    {selectedChannelId !== 'all' && currentChannel?.id === selectedChannelId
                      ? `Search in #${currentChannel.name}`
                      : `Search messages in ${workspace.name}`}
                  </h3>
                  <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mb-4">
                    {selectedChannelId !== 'all'
                      ? `Searching messages inside #${currentChannel?.name}. You can switch to search across all channels anytime.`
                      : 'Type keywords, usernames, or questions to search across all public channels and conversations.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
                    {selectedChannelId !== 'all' && (
                      <button
                        onClick={() => setSelectedChannelId('all')}
                        className="px-2.5 py-1 bg-slack-green/15 text-slack-green rounded border border-slack-green/40 hover:bg-slack-green/25 transition font-medium"
                      >
                        Search across all channels instead
                      </button>
                    )}
                    <span className="px-2 py-1 bg-[var(--theme-bg-surface-hover)] rounded text-[var(--theme-text)] border border-[var(--theme-border)]">
                      <span className="text-slack-green font-mono">⌘K</span> or <span className="text-slack-green font-mono">Ctrl+K</span>
                    </span>
                    <span className="px-2 py-1 bg-[var(--theme-bg-surface-hover)] rounded text-[var(--theme-text)] border border-[var(--theme-border)]">
                      Filter by files
                    </span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="py-12 text-center flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
                  <Loader2 className="w-7 h-7 text-slack-green animate-spin mb-2" />
                  <p className="text-xs text-[var(--theme-text-muted)]">Searching conversations...</p>
                </div>
              )}

              {/* Empty Results State */}
              {hasSearched && !isLoading && results.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
                  <div className="w-12 h-12 rounded-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] flex items-center justify-center mb-3 text-[var(--theme-text-muted)]">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="text-[var(--theme-text)] font-semibold text-sm mb-1">No messages found</h3>
                  <p className="text-xs text-[var(--theme-text-muted)] max-w-sm">
                    No matching messages found for <span className="text-[var(--theme-text)] font-medium">&quot;{query}&quot;</span>. Try checking for typos or resetting your filters.
                  </p>
                </div>
              )}

              {/* Results List */}
              {hasSearched && !isLoading && results.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-[var(--theme-text-muted)] px-1 pb-1">
                    <span>
                      Found <strong className="text-[var(--theme-text)]">{total}</strong> message{total === 1 ? '' : 's'}
                    </span>
                    {total > results.length && (
                      <span className="text-[11px] text-[var(--theme-text-muted)]">Showing top {results.length}</span>
                    )}
                  </div>

                  {results.map((msg) => {
                    const authorName = msg.bot?.name || msg.user?.displayName || msg.user?.username || 'Unknown';
                    const avatarUrl =
                      msg.bot?.avatarUrl ||
                      msg.user?.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`;
                    const channelName = msg.channel?.name || 'general';
                    const channelType = msg.channel?.type || 'PUBLIC';

                    return (
                      <div
                        key={msg.id}
                        className="group bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] hover:border-[var(--theme-border)] rounded-lg p-3 transition flex flex-col gap-2.5 relative"
                      >
                        {/* Top Row: Channel & Timestamp & Quick Jump */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-[var(--theme-text)]">
                            {channelType === 'DIRECT' ? (
                              <span className="text-slack-green font-bold text-xs">@</span>
                            ) : channelType === 'PRIVATE' ? (
                              <Lock size={12} className="text-[var(--theme-text-muted)]" />
                            ) : (
                              <Hash size={13} className="text-[var(--theme-text-muted)]" />
                            )}
                            <span className="text-[var(--theme-text)] font-semibold">
                              {channelName}
                            </span>

                            {msg.parentMessageId && (
                              <span className="flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-[var(--theme-bg-surface)] text-[10px] text-slack-green border border-[var(--theme-border)]">
                                <MessageSquare size={10} />
                                <span>Thread</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-[var(--theme-text-muted)]">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>

                        {/* Middle Row: Author & Content Preview (Clicking previews full message) */}
                        <div
                          onClick={() => setSelectedFullMessage(msg)}
                          className="flex gap-2.5 items-start cursor-pointer hover:bg-[var(--theme-bg-app)] -mx-1 p-1 rounded transition"
                          title="Click to view full message"
                        >
                          <img
                            src={avatarUrl}
                            alt={authorName}
                            className="w-7 h-7 rounded-md object-cover shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-bold text-[var(--theme-text)]">{authorName}</span>
                              {msg.bot && (
                                <span className="text-[9px] font-semibold bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text-muted)] px-1 py-0.2 rounded uppercase">
                                  APP
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--theme-text)] line-clamp-3 break-words whitespace-pre-wrap leading-relaxed">
                              {renderHighlightedContent(msg.content, query)}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Attachments & Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--theme-border)] text-[11px] gap-2">
                          <div className="flex items-center gap-2 text-[var(--theme-text-muted)] truncate">
                            {msg.attachments?.length > 0 && (
                              <span className="flex items-center gap-1 text-[var(--theme-text)]">
                                <Paperclip size={11} className="text-slack-green" />
                                <span>
                                  {msg.attachments.length} file{msg.attachments.length > 1 ? 's' : ''}
                                </span>
                              </span>
                            )}
                            {msg._count?.replies > 0 && (
                              <span className="flex items-center gap-1 text-[var(--theme-text-muted)]">
                                <MessageSquare size={11} />
                                <span>{msg._count.replies}</span>
                              </span>
                            )}
                          </div>

                          {/* Choice: Open Full Message vs Jump to Message */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              onClick={() => setSelectedFullMessage(msg)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] hover:text-[var(--theme-text)] text-xs font-medium transition border border-[var(--theme-border)]"
                              title="Open and read full message"
                            >
                              <Eye size={12} className="text-slack-green" />
                              <span>Open Message</span>
                            </button>

                            <button
                              onClick={() => {
                                onSelectMessage(msg);
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slack-green/20 hover:bg-slack-green/30 text-slack-green hover:text-emerald-300 text-xs font-semibold transition border border-slack-green/40"
                              title="Jump directly to this message in channel timeline"
                            >
                              <span>Jump to</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer / Shortcuts */}
            <div className="px-4 py-2.5 bg-[var(--theme-bg-app)] border-t border-[var(--theme-border)] flex items-center justify-between text-[11px] text-[var(--theme-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded text-[var(--theme-text)] font-mono text-[10px]">
                    ESC
                  </kbd>
                  <span>to close</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded text-[var(--theme-text)] font-mono text-[10px]">
                    Open Message
                  </kbd>
                  <span>to view full</span>
                </span>
              </div>
              <span className="text-[var(--theme-text-muted)] hidden sm:inline">Orbit Search</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
