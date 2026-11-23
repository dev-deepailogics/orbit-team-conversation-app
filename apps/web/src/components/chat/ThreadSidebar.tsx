'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Avatar } from '@/components/project/projectViewUtils';
import { Message, UserProfile, Channel } from '@orbit/types';
import { X, Send, CornerUpLeft, Smile, SmilePlus, Type, Paperclip, FileText, Loader2, Pencil, Trash2, ChevronDown } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { useAnonStore } from '../../stores/anonStore';
import { loadDraft, saveDraft, clearDraft } from '../../lib/drafts';
import { useChatStore } from '../../stores/chatStore';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { AnonAvatar } from './AnonAvatar';
import { BotAvatar } from '../bot/BotAvatar';
import { getTopEmojis, recordEmojiUsage } from '../../lib/emojiStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PollCard } from './PollCard';
import { RichTextEditor, RichTextEditorRef } from './RichTextEditor';
import { FileAttachmentList, formatFileSize, getFileCategory } from './FileAttachmentList';
import { CompressFileConfirmModal } from './CompressFileConfirmModal';
import { compressFile } from '../../lib/compression';
import { useTimeFormat, formatMessageTime } from '../../lib/timeFormat';
import { MessageChangeNote } from './MessageChangeNote';
import { useResizableSidebar, ResizableSidebarOptions } from '../layout/useResizableSidebar';

// Shared by the panel and its loading skeleton so both open at the width the user last dragged it to
const THREAD_SIDEBAR_SIZE: ResizableSidebarOptions = {
  storageKey: 'orbit_thread_sidebar_width',
  defaultWidth: 384,
  minWidth: 300,
  maxWidth: 720,
  side: 'right',
};
const PANEL_CLASS =
  'relative ml-auto h-full w-full sm:w-96 md:w-[var(--sidebar-w)] shadow-2xl md:shadow-none bg-[var(--theme-bg-surface)] border-l border-[var(--theme-border)] flex flex-col select-none';

const ThreadHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="h-14 border-b border-[var(--theme-border)] px-4 flex items-center justify-between">
    <h3 className="font-bold text-[var(--theme-text)] text-sm">Thread</h3>
    <button
      onClick={onClose}
      aria-label="Close thread"
      className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
    >
      <X size={16} />
    </button>
  </div>
);

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <span className={`block rounded ${className}`} style={{ backgroundColor: 'var(--theme-border)' }} />
);

/** Placeholder message rows while a thread loads. */
const MessageRowsSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-4 animate-pulse" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex gap-3 p-2">
        <SkeletonBar className="w-8 h-8 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <SkeletonBar className="h-3 w-28" />
          <SkeletonBar className={`h-3 ${i % 2 ? 'w-1/2' : 'w-4/5'}`} />
        </div>
      </div>
    ))}
  </div>
);

/** The whole panel as a skeleton, for a thread opened by id whose parent message hasn't loaded yet. */
export const ThreadSidebarSkeleton: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const sidebar = useResizableSidebar(THREAD_SIDEBAR_SIZE);
  return (
    <div className={PANEL_CLASS} style={sidebar.style} aria-busy="true" aria-label="Loading thread">
      <ThreadHeader onClose={onClose} />
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        <div className="pb-3 border-b border-[var(--theme-border)]">
          <MessageRowsSkeleton rows={1} />
        </div>
        <MessageRowsSkeleton rows={3} />
      </div>
    </div>
  );
};

interface ThreadSidebarProps {
  parentMessage: Message;
  replies: Message[];
  currentUser: UserProfile | null;
  onClose: () => void;
  onReplyAdded: (reply: Message) => void;
  members?: any[];
  onSelectUserDM?: (user: UserProfile) => void;
  onSelectChannel?: (channel: Channel) => void;
  // Replies load newest-first in pages; these drive loading the earlier ones as the user scrolls up
  hasMoreReplies?: boolean;
  isLoadingOlderReplies?: boolean;
  onLoadOlderReplies?: () => void;
  /** The first page of replies is still loading: show placeholders instead of an empty thread. */
  isLoadingReplies?: boolean;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  parentMessage,
  replies,
  currentUser,
  onClose,
  onReplyAdded,
  members,
  onSelectUserDM,
  onSelectChannel,
  hasMoreReplies = false,
  isLoadingOlderReplies = false,
  onLoadOlderReplies,
  isLoadingReplies = false,
}) => {
  const timeFormat = useTimeFormat();
  // Unsent reply for this thread, restored from this device when the composer mounts (see lib/drafts.ts).
  const draftScope = `thread:${parentMessage.id}`;
  const initialDraft = useMemo(
    () => (currentUser ? loadDraft(currentUser.id, draftScope) : undefined),
    [currentUser?.id, draftScope],
  );
  const [content, setContent] = useState(initialDraft ?? '');
  useEffect(() => {
    setContent(initialDraft ?? '');
  }, [initialDraft, draftScope]);
  const sidebar = useResizableSidebar(THREAD_SIDEBAR_SIZE);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [threadAttachments, setThreadAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeEmojiMessageId, setActiveEmojiMessageId] = useState<string | null>(null);
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [topEmojis, setTopEmojis] = useState<string[]>(['👍', '❤️', '🔥', '🎉', '🚀']);
  const [showFormatting, setShowFormatting] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<Message | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compression Confirmation State
  const [pendingCompressFiles, setPendingCompressFiles] = useState<File[]>([]);
  const [showCompressModal, setShowCompressModal] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const currentWorkspace = useChatStore((state) => state.currentWorkspace);
  const isWsAdmin =
    currentWorkspace?.ownerId === currentUser?.id ||
    members?.some(
      (m) =>
        m.userId === currentUser?.id &&
        (m.role === 'ADMIN' || m.role === 'OWNER')
    );
  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await api.patch(`/api/messages/${messageId}`, {
        content: editContent.trim(),
      });
      useChatStore.getState().updateMessage(res.data);
      setEditingMessageId(null);
      setEditContent('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to edit message');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleDeleteMessage = async () => {
    if (!deleteConfirmMessage) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/api/messages/${deleteConfirmMessage.id}`);
      if (res.data?.message) {
        useChatStore.getState().updateMessage(res.data.message);
      }
      setDeleteConfirmMessage(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  const repliesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [firstUnreadReplyId, setFirstUnreadReplyId] = useState<string | null>(null);
  const previousRepliesCountRef = useRef(0);
  const previousScrollHeightRef = useRef(0); // set just before older replies are requested, to keep the view in place
  const editorRef = useRef<RichTextEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isParentAnon = !!parentMessage.isAnonymous;
  // The parent's reply count covers replies that haven't been loaded yet; never show fewer than are on screen
  const totalReplies = Math.max(parentMessage.replyCount ?? 0, replies.length);

  const mentionUsers = React.useMemo(() => {
    if (isParentAnon) return [];
    if (!members) return [];
    return members
      .map((m) => m.user)
      .filter(Boolean)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
      }));
  }, [members, isParentAnon]);

  const handleMentionClick = (username: string) => {
    if (isParentAnon) return;
    const targetMember = members?.find(
      (m) => m.user?.username?.toLowerCase() === username.toLowerCase()
    );
    if (targetMember?.user && onSelectUserDM) {
      onSelectUserDM(targetMember.user);
    }
  };

  const handleChannelClick = (channelId: string) => {
    const ch = useChatStore.getState().channels.find((c) => c.id === channelId);
    if (ch && onSelectChannel) {
      onSelectChannel(ch);
    }
  };

  useEffect(() => {
    setTopEmojis(getTopEmojis(5));
  }, []);

  useEffect(() => {
    // Older replies were added above the ones on screen: keep the view exactly where it was, don't treat them as new
    if (previousScrollHeightRef.current > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += scrollContainerRef.current.scrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = 0;
      previousRepliesCountRef.current = replies.length;
      return;
    }

    // Only auto-scroll if user is already near bottom OR if the new reply was sent by the current user
    if (replies.length > previousRepliesCountRef.current) {
      const lastReply = replies[replies.length - 1];
      const isSentByMe = Boolean(
        lastReply && (
          lastReply.isSelf ||
          (currentUser && lastReply.userId === currentUser.id)
        )
      );

      if (isNearBottomRef.current || isSentByMe) {
        // The first replies of an opened thread jump to the bottom at once: a smooth scroll would pass through the top
        // and trigger loading earlier replies that nobody asked for
        repliesEndRef.current?.scrollIntoView({ behavior: previousRepliesCountRef.current === 0 ? 'auto' : 'smooth' });
        setFirstUnreadReplyId(null);
      } else {
        if (!isSentByMe) {
          setFirstUnreadReplyId((prev) => prev || lastReply?.id || null);
        }
      }
    }
    previousRepliesCountRef.current = replies.length;
  }, [replies, currentUser]);

  // A request that fails or returns nothing new must not leave a stale height behind for the next real update
  useEffect(() => {
    if (!isLoadingOlderReplies) previousScrollHeightRef.current = 0;
  }, [isLoadingOlderReplies]);

  const loadOlderReplies = () => {
    if (!hasMoreReplies || isLoadingOlderReplies || !onLoadOlderReplies) return;
    if (scrollContainerRef.current) previousScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    onLoadOlderReplies();
  };

  const handleThreadScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = isNearBottom;

    if (isNearBottom) {
      setFirstUnreadReplyId(null);
    }

    // Close to the top: bring in the earlier replies
    if (target.scrollTop <= 40) loadOlderReplies();
  };

  // Default to the reply input field when thread is opened or parent message changes
  useEffect(() => {
    isNearBottomRef.current = true;
    setFirstUnreadReplyId(null);
    previousRepliesCountRef.current = 0;
    const timer = setTimeout(() => {
      editorRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [parentMessage.id]);

  // Focus reply input when quoting a message in thread
  useEffect(() => {
    if (replyingToMessage) {
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [replyingToMessage]);

  const handleReaction = async (messageId: string, emoji: string) => {
    recordEmojiUsage(emoji);
    setTopEmojis(getTopEmojis(5));
    try {
      await api.post(`/api/messages/${messageId}/reactions`, { emoji });
    } catch (err) {
      console.error('Failed to react in thread', err);
    }
  };

  const processThreadUploadFiles = async (filesToUpload: File[], shouldCompress: boolean) => {
    setIsUploading(true);
    if (shouldCompress) {
      setIsCompressing(true);
    }

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        let file = filesToUpload[i];

        if (shouldCompress) {
          try {
            file = await compressFile(file);
          } catch (compErr) {
            console.error('Compression failed for thread file', file.name, compErr);
          }
        }

        const formData = new FormData();
        if (parentMessage.channelId) {
          formData.append('channelId', parentMessage.channelId);
        }
        formData.append('file', file);

        const channelQuery = parentMessage.channelId ? `?channelId=${encodeURIComponent(parentMessage.channelId)}` : '';
        const res = await api.post(`/api/files/upload${channelQuery}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data) {
          setThreadAttachments((prev) => [...prev, res.data]);
        }
      }
    } catch (err) {
      console.error('Failed to upload thread file', err);
    } finally {
      setIsUploading(false);
      setIsCompressing(false);
      setShowCompressModal(false);
      setPendingCompressFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setPendingCompressFiles(files);
    setShowCompressModal(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setPendingCompressFiles(files);
    setShowCompressModal(true);
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawMarkdown = editorRef.current?.getMarkdown() || content.trim();
    if ((!rawMarkdown.trim() && threadAttachments.length === 0) || isSubmitting || isUploading) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/messages/${parentMessage.id}/replies`, {
        content: rawMarkdown.trim(),
        quotedMessageId: replyingToMessage?.id,
        attachments: threadAttachments,
      });
      onReplyAdded(res.data);
      editorRef.current?.clear();
      setContent('');
      if (currentUser) clearDraft(currentUser.id, draftScope);
      setThreadAttachments([]);
      setReplyingToMessage(null);
      setShowComposerEmoji(false);
    } catch (err) {
      console.error('Failed to post reply', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`thread-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
      setTimeout(() => {
        el.classList.remove('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
      }, 2000);
    }
  };

  const isParentSelf = parentMessage.isSelf || (!isParentAnon && parentMessage.userId === currentUser?.id);
  // Admins can delete a message, not edit it; a poll's text comes from its question and options, so nobody edits it
  const canEditParent = !parentMessage.isDeleted && isParentSelf && !parentMessage.poll;
  const canDeleteParent = !parentMessage.isDeleted && (isParentSelf || isWsAdmin || isSuperAdmin);
  const revealAnon = useAnonStore((s) => s.reveal);
  const authorName = isParentAnon
    ? (parentMessage.anonName || 'Anonymous')
    : (parentMessage.user?.displayName || parentMessage.bot?.name || 'Unknown');
  const parentAnonEmoji = parentMessage.anonEmoji || '🎭';
  const avatarUrl = parentMessage.user?.avatarUrl || parentMessage.bot?.avatarUrl || `/api/avatar/bottts/svg?seed=${authorName}`;

  return (
    <div className={PANEL_CLASS} style={sidebar.style}>
      {sidebar.handle}
      <ThreadHeader onClose={onClose} />

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleThreadScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Parent Message */}
        <div
          id={`thread-msg-${parentMessage.id}`}
          className="group relative flex gap-3 pb-3 border-b border-[var(--theme-border)] p-2 rounded-lg transition-all duration-300"
        >
          {isParentAnon ? (
            <div
              className="mt-0.5 shrink-0"
            >
              <AnonAvatar name={authorName} emoji={parentAnonEmoji} size={32} />
            </div>
          ) : parentMessage.bot && !parentMessage.user ? (
            <BotAvatar name={authorName} src={parentMessage.bot.avatarUrl} size={32} className="mt-0.5" />
          ) : (
            <Avatar name={authorName} src={avatarUrl} size={32} className="mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--theme-text)]">{authorName}</span>
              {isParentAnon && (
                <span
                  className={`text-[9px] font-semibold px-1 py-0.2 rounded uppercase ${
                    isParentSelf
                      ? 'bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-200 border border-purple-500/40'
                      : 'bg-[var(--theme-bg-surface)] text-[var(--theme-text)] border border-[var(--theme-border)]'
                  }`}
                >
                  {isParentSelf && revealAnon ? 'You (Anon)' : 'Anonymous'}
                </span>
              )}
              <span className="text-[10px] text-[var(--theme-text-muted)]">
                {formatMessageTime(parentMessage.createdAt, timeFormat)}
              </span>
              <MessageChangeNote message={parentMessage} timeFormat={timeFormat} className="text-[9px]" />
            </div>

            {parentMessage.isDeleted ? (
              <div className="flex items-center gap-1.5 py-1 text-xs italic select-none text-[var(--theme-text-muted)]">
                <Trash2 size={12} className="opacity-60 shrink-0" />
                <span>
                  {(parentMessage as any).deletedByName
                    ? `This message was deleted by ${(parentMessage as any).deletedByName}`
                    : 'This message was deleted'}
                </span>
              </div>
            ) : editingMessageId === parentMessage.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit(parentMessage.id);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  rows={2}
                  autoFocus
                  className="w-full text-xs p-2 rounded-lg bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-slack-activeChannel resize-y"
                  placeholder="Edit message..."
                />
                <div className="flex items-center justify-between text-[10px] text-[var(--theme-text-muted)]">
                  <span>escape to cancel • enter to save</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingEdit}
                      className="px-2 py-0.5 rounded text-[10px] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(parentMessage.id)}
                      disabled={isSavingEdit || !editContent.trim()}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slack-green text-white transition flex items-center gap-1"
                    >
                      {isSavingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {parentMessage.poll ? (
                  <PollCard messageId={parentMessage.id} poll={parentMessage.poll} isAnonymous={isParentAnon} />
                ) : (
                  <div className="text-xs text-[var(--theme-text)] mt-1 max-w-none break-words">
                    <MarkdownRenderer
                      content={parentMessage.content}
                      currentUsername={currentUser?.username}
                      onMentionClick={handleMentionClick}
                      onChannelClick={handleChannelClick}
                    />
                  </div>
                )}

                {/* Parent Message Attachments */}
                {parentMessage.attachments && parentMessage.attachments.length > 0 && (
                  <div className="mt-2">
                    <FileAttachmentList
                      attachments={parentMessage.attachments}
                      currentUser={currentUser}
                      onFileDeleted={(id) => useChatStore.getState().removeAttachment(id)}
                      isThreadView
                    />
                  </div>
                )}

                {/* Parent Message Reactions - ONLY rendered if reactions exist */}
                {(() => {
                  const reactionCounts = (parentMessage.reactions || []).reduce(
                    (acc: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } }, r) => {
                      if (!acc[r.emoji]) {
                        acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                      }
                      acc[r.emoji].count += 1;
                      if (r.user?.displayName) {
                        acc[r.emoji].users.push(isParentAnon ? 'Anonymous' : r.user.displayName);
                      }
                      if (r.userId === currentUser?.id) acc[r.emoji].hasReacted = true;
                      return acc;
                    },
                    {}
                  );

                  const entries = Object.entries(reactionCounts);
                  if (entries.length === 0) return null;

                  return (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {entries.map(([emoji, data]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(parentMessage.id, emoji)}
                          title={data.users.join(', ')}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition border ${
                            data.hasReacted
                              ? 'bg-slack-activeChannel/20 border-slack-activeChannel text-slack-activeChannel font-bold'
                              : 'bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border-[var(--theme-border)] text-[var(--theme-text)]'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{data.count}</span>
                        </button>
                      ))}

                      <button
                        onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
                        title="Add reaction"
                      >
                        <SmilePlus size={10} />
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Floating Hover Bubble for parent message */}
          {!parentMessage.isDeleted && (
            <div className="absolute right-2 -top-2.5 hidden group-hover:flex items-center bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-xl px-1.5 py-0.5 gap-0.5 z-20 backdrop-blur-sm">
              {/* Top 3 Quick Reactions */}
              <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--theme-border)] mr-0.5">
                {topEmojis.slice(0, 3).map((em) => (
                  <button
                    key={em}
                    onClick={() => handleReaction(parentMessage.id, em)}
                    className="hover:scale-125 transition text-[11px] p-0.5 rounded hover:bg-[var(--theme-bg-surface-hover)]"
                    title={`React with ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
                title="More emojis..."
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
              >
                <SmilePlus size={12} />
              </button>
              <button
                onClick={() => setReplyingToMessage(parentMessage)}
                title="Quote Reply"
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
              >
                <CornerUpLeft size={12} />
              </button>
              {canEditParent && (
                <button
                  onClick={() => {
                    setEditingMessageId(parentMessage.id);
                    setEditContent(parentMessage.content);
                  }}
                  title="Edit message"
                  className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                >
                  <Pencil size={12} />
                </button>
              )}
              {canDeleteParent && (
                <button
                  onClick={() => setDeleteConfirmMessage(parentMessage)}
                  title="Delete message"
                  className="p-1 text-red-600 dark:text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}

          {/* Anchored Mini Emoji Popover */}
          {!parentMessage.isDeleted && activeEmojiMessageId === parentMessage.id && (
            <EmojiPickerPopover
              isOpen={true}
              onClose={() => setActiveEmojiMessageId(null)}
              onSelectEmoji={(emoji) => handleReaction(parentMessage.id, emoji)}
              title="React in Thread"
              positionClass="top-8 right-2"
            />
          )}
        </div>

        {/* Reply Count Separator */}
        <div className="flex items-center gap-2 py-1">
          <span className="text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
            {totalReplies} {totalReplies === 1 ? 'Reply' : 'Replies'}
          </span>
          <div className="flex-1 h-px bg-[var(--theme-bg-surface-hover)]" />
        </div>

        {/* Earlier replies: loaded automatically on scrolling up, or with this button */}
        {hasMoreReplies && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadOlderReplies}
              disabled={isLoadingOlderReplies}
              className="px-3 py-1 text-xs font-medium rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg-surface)] text-[var(--theme-text)] flex items-center gap-2 transition disabled:opacity-50 hover:opacity-85"
            >
              {isLoadingOlderReplies ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading earlier replies...</span>
                </>
              ) : (
                <span>Load earlier replies</span>
              )}
            </button>
          </div>
        )}

        {isLoadingReplies && <MessageRowsSkeleton rows={3} />}

        {/* Replies List */}
        {replies.map((reply, idx) => {
          const isReplyAnon = !!reply.isAnonymous || isParentAnon;
          const isReplySelf = reply.isSelf || (!isReplyAnon && reply.userId === currentUser?.id);
          const canEditReply = !reply.isDeleted && isReplySelf;
          const canDeleteReply = !reply.isDeleted && (isReplySelf || isWsAdmin || isSuperAdmin);
          const replyAuthor = isReplyAnon
            ? (reply.anonName || 'Anonymous')
            : (reply.user?.displayName || 'Unknown');
          const replyEmoji = reply.anonEmoji || '🎭';
          const replyAvatar = reply.user?.avatarUrl || `/api/avatar/bottts/svg?seed=${replyAuthor}`;

          return (
            <React.Fragment key={reply.id}>
              {firstUnreadReplyId === reply.id && (
                <div className="flex items-center gap-2 my-2 select-none relative z-10 animate-in fade-in duration-200">
                  <div className="flex-1 h-[1.5px] bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>New Replies</span>
                  </div>
                  <div className="flex-1 h-[1.5px] bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                </div>
              )}
              <div
                id={`thread-msg-${reply.id}`}
                className="group relative flex gap-3 p-2 rounded-lg hover:bg-[var(--theme-bg-surface)] transition-all duration-300"
              >
              {isReplyAnon ? (
                <div
                  className="mt-0.5 shrink-0"
                >
                  <AnonAvatar name={replyAuthor} emoji={replyEmoji} size={28} />
                </div>
              ) : (
                <Avatar name={replyAuthor} src={replyAvatar} size={28} className="mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[var(--theme-text)]">{replyAuthor}</span>
                  {isReplyAnon && (
                    <span
                      className={`text-[9px] font-semibold px-1 py-0.2 rounded uppercase ${
                        isReplySelf
                          ? 'bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-200 border border-purple-500/40'
                          : 'bg-[var(--theme-bg-surface)] text-[var(--theme-text)] border border-[var(--theme-border)]'
                      }`}
                    >
                      {isReplySelf && revealAnon ? 'You (Anon)' : 'Anonymous'}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--theme-text-muted)]">
                    {formatMessageTime(reply.createdAt, timeFormat)}
                  </span>
                  <MessageChangeNote message={reply} timeFormat={timeFormat} className="text-[9px]" />
                </div>

                {reply.isDeleted ? (
                  <div className="flex items-center gap-1.5 py-1 text-xs italic select-none text-[var(--theme-text-muted)]">
                    <Trash2 size={12} className="opacity-60 shrink-0" />
                    <span>
                      {(reply as any).deletedByName ? `This message was deleted by ${(reply as any).deletedByName}` : 'This message was deleted'}
                    </span>
                  </div>
                ) : editingMessageId === reply.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveEdit(reply.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelEdit();
                        }
                      }}
                      rows={2}
                      autoFocus
                      className="w-full text-xs p-2 rounded-lg bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-slack-activeChannel resize-y"
                      placeholder="Edit reply..."
                    />
                    <div className="flex items-center justify-between text-[10px] text-[var(--theme-text-muted)]">
                      <span>escape to cancel • enter to save</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="px-2 py-0.5 rounded text-[10px] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(reply.id)}
                          disabled={isSavingEdit || !editContent.trim()}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slack-green text-white transition flex items-center gap-1"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Quoted Message in Thread */}
                    {reply.quotedMessage && (
                      <div
                        onClick={() => scrollToMessage(reply.quotedMessage!.id)}
                        className="mt-1 mb-1 flex items-center gap-2 bg-[var(--theme-bg-surface)] hover:bg-[var(--theme-bg-surface-hover)] border-l-4 border-slack-green rounded-r-lg px-2.5 py-1 cursor-pointer text-xs transition max-w-full shadow-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slack-green text-[10px] block">
                            {isReplyAnon || reply.quotedMessage.isAnonymous
                              ? (reply.quotedMessage.anonName ? `${reply.quotedMessage.anonEmoji || '🎭'} ${reply.quotedMessage.anonName}` : 'Anonymous')
                              : (reply.quotedMessage.user?.displayName || 'Teammate')}
                          </span>
                          <span className="text-[var(--theme-text)] text-[10px] truncate block max-w-xs">
                            {reply.quotedMessage.content}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-[var(--theme-text)] mt-0.5 max-w-none break-words">
                      <MarkdownRenderer
                        content={reply.content}
                        currentUsername={currentUser?.username}
                        onMentionClick={handleMentionClick}
                        onChannelClick={handleChannelClick}
                      />
                    </div>

                    {/* Reply Attachments */}
                    {reply.attachments && reply.attachments.length > 0 && (
                      <div className="mt-2">
                        <FileAttachmentList
                          attachments={reply.attachments}
                          currentUser={currentUser}
                          onFileDeleted={(id) => useChatStore.getState().removeAttachment(id)}
                          isThreadView
                        />
                      </div>
                    )}

                    {/* Reply Reactions - ONLY rendered when reactions exist */}
                    {(() => {
                      const reactionCounts = (reply.reactions || []).reduce(
                        (acc: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } }, r) => {
                          if (!acc[r.emoji]) {
                            acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                          }
                          acc[r.emoji].count += 1;
                          if (r.user?.displayName) {
                            acc[r.emoji].users.push(isReplyAnon ? 'Anonymous' : r.user.displayName);
                          }
                          if (r.userId === currentUser?.id) acc[r.emoji].hasReacted = true;
                          return acc;
                        },
                        {}
                      );

                      const entries = Object.entries(reactionCounts);
                      if (entries.length === 0) return null;

                      return (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {entries.map(([emoji, data]) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(reply.id, emoji)}
                              title={data.users.join(', ')}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition border ${
                                data.hasReacted
                                  ? 'bg-slack-activeChannel/20 border-slack-activeChannel text-slack-activeChannel font-bold'
                                  : 'bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border-[var(--theme-border)] text-[var(--theme-text)]'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{data.count}</span>
                            </button>
                          ))}

                          <button
                            onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
                            title="Add reaction"
                          >
                            <SmilePlus size={10} />
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Floating Hover Bubble for reply */}
              {!reply.isDeleted && (
                <div className="absolute right-2 -top-2 hidden group-hover:flex items-center bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-xl px-1.5 py-0.5 gap-0.5 z-20 backdrop-blur-sm">
                  {/* Top 3 Quick Reactions */}
                  <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--theme-border)] mr-0.5">
                    {topEmojis.slice(0, 3).map((em) => (
                      <button
                        key={em}
                        onClick={() => handleReaction(reply.id, em)}
                        className="hover:scale-125 transition text-[11px] p-0.5 rounded hover:bg-[var(--theme-bg-surface-hover)]"
                        title={`React with ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                    title="More emojis..."
                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                  >
                    <SmilePlus size={12} />
                  </button>
                  <button
                    onClick={() => setReplyingToMessage(reply)}
                    title="Quote Reply"
                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                  >
                    <CornerUpLeft size={12} />
                  </button>
                  {canEditReply && (
                    <button
                      onClick={() => {
                        setEditingMessageId(reply.id);
                        setEditContent(reply.content);
                      }}
                      title="Edit reply"
                      className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {canDeleteReply && (
                    <button
                      onClick={() => setDeleteConfirmMessage(reply)}
                      title="Delete reply"
                      className="p-1 text-red-600 dark:text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Anchored Mini Emoji Popover */}
              {!reply.isDeleted && activeEmojiMessageId === reply.id && (
                <EmojiPickerPopover
                  isOpen={true}
                  onClose={() => setActiveEmojiMessageId(null)}
                  onSelectEmoji={(emoji) => handleReaction(reply.id, emoji)}
                  title="React in Thread"
                  positionClass={
                    idx >= Math.max(0, replies.length - 3)
                      ? 'bottom-10 right-2'
                      : 'top-8 right-2'
                  }
                />
              )}
            </div>
          </React.Fragment>
        );
      })}
      <div ref={repliesEndRef} />
    </div>

      {/* Reply Input */}
      <div className="p-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-app)] relative">
        {/* Floating "New replies ↓" pill positioned above the input box */}
        {firstUnreadReplyId && !isNearBottomRef.current && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                setFirstUnreadReplyId(null);
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slack-green hover:bg-slack-green/90 text-white text-[11px] font-semibold shadow-xl border border-black/10 dark:border-white/10 transition transform hover:scale-105 cursor-pointer"
            >
              <span>New replies</span>
              <ChevronDown size={13} />
            </button>
          </div>
        )}

        {/* Quote Reply Banner */}
        {replyingToMessage && (
          <div className="flex items-center justify-between bg-[var(--theme-bg-surface)] border-l-4 border-slack-green rounded-t-lg px-3 py-1.5 mb-1 text-xs">
            <div className="min-w-0">
              <span className="text-slack-green font-semibold text-[11px] block">
                Replying to{' '}
                {isParentAnon || replyingToMessage.isAnonymous
                  ? replyingToMessage.anonName
                    ? `${replyingToMessage.anonEmoji || '🎭'} ${replyingToMessage.anonName}`
                    : 'Anonymous'
                  : replyingToMessage.user?.displayName || 'Teammate'}
              </span>
              <span className="text-[var(--theme-text-muted)] text-[11px] truncate block max-w-xs">
                {replyingToMessage.content}
              </span>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              title="Cancel quote reply"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendReply}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`bg-[var(--theme-bg-surface)] border rounded-lg relative transition ${
            isDragOver ? 'ring-2 ring-slack-green/50 border-slack-green' : 'border-[var(--theme-border)]'
          }`}
        >
          {/* Uploaded attachments preview */}
          {threadAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--theme-bg-app)] border-b border-[var(--theme-border)]">
              {threadAttachments.map((file, idx) => (
                <div
                  key={file.id || idx}
                  className="flex items-center gap-1.5 px-2 py-1 bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] rounded-md text-xs text-[var(--theme-text)]"
                >
                  <FileText size={12} className="text-slack-green shrink-0" />
                  <span className="truncate max-w-[120px] font-medium text-[11px]">{file.fileName}</span>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">({formatFileSize(file.fileSize)})</span>
                  <button
                    type="button"
                    onClick={() => setThreadAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-[var(--theme-text-muted)] hover:text-red-400 ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <RichTextEditor
            key={parentMessage.id}
            ref={editorRef}
            initialValue={initialDraft}
            autoFocus={true}
            placeholder={isParentAnon ? 'Reply anonymously...' : 'Reply...'}
            showToolbar={showFormatting}
            mentionUsers={mentionUsers}
            minHeight="44px"
            onTyping={(text) => {
              setContent(text);
              if (currentUser) saveDraft(currentUser.id, draftScope, editorRef.current?.getMarkdown() ?? text);
            }}
            onSubmit={() => handleSendReply()}
            onPasteFiles={(files) => {
              setPendingCompressFiles((prev) => (showCompressModal ? [...prev, ...files] : files));
              setShowCompressModal(true);
            }}
          />
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--theme-bg-app)] border-t border-[var(--theme-border)] rounded-b-lg">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Attach files"
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition disabled:opacity-40"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin text-slack-green" /> : <Paperclip size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setShowFormatting(!showFormatting)}
                title={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                className={`p-1 rounded transition ${
                  showFormatting ? 'bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]'
                }`}
              >
                <Type size={14} />
              </button>

              <button
                type="button"
                onClick={() => setShowComposerEmoji(!showComposerEmoji)}
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                title="Add emoji"
              >
                <Smile size={14} />
              </button>
            </div>

            <button
              type="submit"
              disabled={(!content.trim() && threadAttachments.length === 0) || isSubmitting || isUploading}
              className="p-1 bg-slack-green hover:bg-[#008a65] text-white rounded transition disabled:opacity-30"
            >
              <Send size={13} />
            </button>
          </div>

          {/* Thread Composer Emoji Popover */}
          <EmojiPickerPopover
            isOpen={showComposerEmoji}
            onClose={() => setShowComposerEmoji(false)}
            onSelectEmoji={(emoji) => {
              editorRef.current?.insertEmoji(emoji);
            }}
            title="Add Emoji"
            positionClass="bottom-full mb-2 left-2 z-50"
          />
        </form>
      </div>

      {/* Delete Message Confirmation Modal */}
      {deleteConfirmMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] shadow-2xl p-5 space-y-4 text-[var(--theme-text)]">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                <Trash2 size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Delete message</h3>
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  Are you sure you want to delete this message? This message will be marked as deleted.
                </p>
              </div>
            </div>

            {deleteConfirmMessage.content && (
              <div className="p-2.5 rounded-lg bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] max-h-20 overflow-y-auto italic line-clamp-3">
                &ldquo;{deleteConfirmMessage.content}&rdquo;
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmMessage(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMessage}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compression Confirmation Modal */}
      <CompressFileConfirmModal
        isOpen={showCompressModal}
        files={pendingCompressFiles}
        isCompressing={isCompressing}
        onConfirmCompress={() => processThreadUploadFiles(pendingCompressFiles, true)}
        onSkip={() => processThreadUploadFiles(pendingCompressFiles, false)}
        onCancel={() => {
          setShowCompressModal(false);
          setPendingCompressFiles([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
};
