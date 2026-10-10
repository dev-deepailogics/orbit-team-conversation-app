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
          className="bg-slack-green/30 text-emerald-300 font-semibold px-0.5 rounded"
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
      <div className="relative w-full max-w-2xl bg-[#1F2326] border border-[#383F45] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* If viewing a single full message */}
        {selectedFullMessage ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Full Message View Header */}
            <div className="p-3.5 sm:p-4 border-b border-[#383F45]/60 bg-[#1A1D21] flex items-center justify-between">
              <button
                onClick={() => setSelectedFullMessage(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-[#272B30] hover:bg-[#343940] px-2.5 py-1.5 rounded-lg border border-gray-700 transition"
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
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Full Message Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Channel and Time Info */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-gray-800">
                <div className="flex items-center gap-1.5 font-medium text-gray-300">
                  {selectedFullMessage.channel?.type === 'DIRECT' ? (
                    <span className="text-slack-green font-bold text-xs">@</span>
                  ) : selectedFullMessage.channel?.type === 'PRIVATE' ? (
                    <Lock size={13} className="text-gray-400" />
                  ) : (
                    <Hash size={14} className="text-gray-400" />
                  )}
                  <span className="text-white font-semibold">
                    {selectedFullMessage.channel?.name || 'channel'}
                  </span>
                  {selectedFullMessage.parentMessageId && (
                    <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-slack-green border border-gray-700">
                      <MessageSquare size={10} />
                      <span>Thread Reply</span>
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">
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
                    <span className="font-bold text-sm text-white">
                      {selectedFullMessage.bot?.name ||
                        selectedFullMessage.user?.displayName ||
                        selectedFullMessage.user?.username ||
                        'Teammate'}
                    </span>
                    {selectedFullMessage.bot && (
                      <span className="text-[10px] font-semibold bg-[#2C3136] text-gray-300 px-1.5 py-0.2 rounded uppercase">
                        APP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    @{selectedFullMessage.user?.username || 'user'}
                  </span>
                </div>
              </div>

              {/* Message Content (Full Markdown) */}
              <div className="bg-[#272B30]/70 border border-gray-700/60 rounded-xl p-4 text-sm text-gray-100 break-words leading-relaxed">
                <MarkdownRenderer content={selectedFullMessage.content} />
              </div>

              {/* Attachments */}
              {selectedFullMessage.attachments && selectedFullMessage.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Attachments ({selectedFullMessage.attachments.length})
                  </span>
                  <div className="space-y-2">
                    {selectedFullMessage.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#272B30] border border-gray-700 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Paperclip size={16} className="text-slack-green shrink-0" />
                          <span className="text-gray-200 font-medium truncate">{att.fileName}</span>
                          <span className="text-gray-500 text-[11px] shrink-0">
                            ({Math.round(att.fileSize / 1024)} KB)
                          </span>
                        </div>
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={att.fileName}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#383F45] hover:bg-[#454D54] text-white text-xs font-medium transition shrink-0 ml-3"
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
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                    Reactions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFullMessage.reactions.map((r: any) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#272B30] border border-gray-700 text-xs text-gray-200"
                      >
                        <span>{r.emoji}</span>
                        <span className="text-[11px] text-gray-400">{r.user?.displayName || '1'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full Message Footer Actions */}
            <div className="p-3 bg-[#1A1D21] border-t border-[#383F45]/60 flex items-center justify-between">
              <button
                onClick={() => setSelectedFullMessage(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
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
            <div className="p-3 sm:p-4 border-b border-[#383F45]/60 flex items-center gap-2.5 bg-[#1A1D21]">
              <div className="relative flex-1 flex items-center">
                {isLoading ? (
                  <Loader2 className="absolute left-3 w-5 h-5 text-slack-green animate-spin pointer-events-none" />
                ) : (
                  <Search className="absolute left-3 w-5 h-5 text-gray-400 pointer-events-none" />
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
                  className="w-full bg-[#272B30] text-white pl-10 pr-9 py-2.5 rounded-lg border border-gray-700/70 focus:border-slack-green focus:outline-none focus:ring-1 focus:ring-slack-green text-sm placeholder-gray-500 transition"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 p-1 text-gray-400 hover:text-white rounded-md transition"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-3 sm:px-4 py-2 bg-[#22262A] border-b border-[#383F45]/40 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-gray-400 shrink-0 font-medium">Filter by:</span>

              {/* Channel selector */}
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="bg-[#1A1D21] text-gray-200 border border-gray-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-slack-green transition cursor-pointer"
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
                  className="bg-[#1A1D21] text-gray-200 border border-gray-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-slack-green transition cursor-pointer"
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
                    : 'bg-[#1A1D21] border-gray-700 text-gray-400 hover:text-gray-200'
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
                  className="text-gray-400 hover:text-white underline text-[11px] ml-auto shrink-0"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Search Results / Content Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[220px]">
              {/* Initial State / Prompt */}
              {!hasSearched && !isLoading && (
                <div className="py-10 text-center flex flex-col items-center justify-center text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-gray-800/80 border border-gray-700 flex items-center justify-center mb-3 text-slack-green">
                    <Search size={22} />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">
                    {selectedChannelId !== 'all' && currentChannel?.id === selectedChannelId
                      ? `Search in #${currentChannel.name}`
                      : `Search messages in ${workspace.name}`}
                  </h3>
                  <p className="text-xs text-gray-400 max-w-sm mb-4">
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
                    <span className="px-2 py-1 bg-[#2C3136] rounded text-gray-300 border border-gray-700">
                      <span className="text-slack-green font-mono">⌘K</span> or <span className="text-slack-green font-mono">Ctrl+K</span>
                    </span>
                    <span className="px-2 py-1 bg-[#2C3136] rounded text-gray-300 border border-gray-700">
                      Filter by files
                    </span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="py-12 text-center flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-7 h-7 text-slack-green animate-spin mb-2" />
                  <p className="text-xs text-gray-400">Searching conversations...</p>
                </div>
              )}

              {/* Empty Results State */}
              {hasSearched && !isLoading && results.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center justify-center text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-gray-800/60 border border-gray-700 flex items-center justify-center mb-3 text-gray-400">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">No messages found</h3>
                  <p className="text-xs text-gray-400 max-w-sm">
                    No matching messages found for <span className="text-white font-medium">&quot;{query}&quot;</span>. Try checking for typos or resetting your filters.
                  </p>
                </div>
              )}

              {/* Results List */}
              {hasSearched && !isLoading && results.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-400 px-1 pb-1">
                    <span>
                      Found <strong className="text-white">{total}</strong> message{total === 1 ? '' : 's'}
                    </span>
                    {total > results.length && (
                      <span className="text-[11px] text-gray-500">Showing top {results.length}</span>
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
                        className="group bg-[#272B30]/60 hover:bg-[#2F343A] border border-gray-700/60 hover:border-gray-600 rounded-lg p-3 transition flex flex-col gap-2.5 relative"
                      >
                        {/* Top Row: Channel & Timestamp & Quick Jump */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-gray-300">
                            {channelType === 'DIRECT' ? (
                              <span className="text-slack-green font-bold text-xs">@</span>
                            ) : channelType === 'PRIVATE' ? (
                              <Lock size={12} className="text-gray-400" />
                            ) : (
                              <Hash size={13} className="text-gray-400" />
                            )}
                            <span className="text-white font-semibold">
                              {channelName}
                            </span>

                            {msg.parentMessageId && (
                              <span className="flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-slack-green border border-gray-700">
                                <MessageSquare size={10} />
                                <span>Thread</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-gray-400">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>

                        {/* Middle Row: Author & Content Preview (Clicking previews full message) */}
                        <div
                          onClick={() => setSelectedFullMessage(msg)}
                          className="flex gap-2.5 items-start cursor-pointer hover:bg-black/10 -mx-1 p-1 rounded transition"
                          title="Click to view full message"
                        >
                          <img
                            src={avatarUrl}
                            alt={authorName}
                            className="w-7 h-7 rounded-md object-cover shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-bold text-gray-200">{authorName}</span>
                              {msg.bot && (
                                <span className="text-[9px] font-semibold bg-[#2C3136] text-gray-400 px-1 py-0.2 rounded uppercase">
                                  APP
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-300 line-clamp-3 break-words whitespace-pre-wrap leading-relaxed">
                              {renderHighlightedContent(msg.content, query)}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Attachments & Action Buttons */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-700/40 text-[11px] gap-2">
                          <div className="flex items-center gap-2 text-gray-400 truncate">
                            {msg.attachments?.length > 0 && (
                              <span className="flex items-center gap-1 text-gray-300">
                                <Paperclip size={11} className="text-slack-green" />
                                <span>
                                  {msg.attachments.length} file{msg.attachments.length > 1 ? 's' : ''}
                                </span>
                              </span>
                            )}
                            {msg._count?.replies > 0 && (
                              <span className="flex items-center gap-1 text-gray-400">
                                <MessageSquare size={11} />
                                <span>{msg._count.replies}</span>
                              </span>
                            )}
                          </div>

                          {/* Choice: Open Full Message vs Jump to Message */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              onClick={() => setSelectedFullMessage(msg)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#383F45]/70 hover:bg-[#434B52] text-gray-200 hover:text-white text-xs font-medium transition border border-gray-700/60"
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
            <div className="px-4 py-2.5 bg-[#1A1D21] border-t border-[#383F45]/60 flex items-center justify-between text-[11px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono text-[10px]">
                    ESC
                  </kbd>
                  <span>to close</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono text-[10px]">
                    Open Message
                  </kbd>
                  <span>to view full</span>
                </span>
              </div>
              <span className="text-gray-500 hidden sm:inline">Orbit Search</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
