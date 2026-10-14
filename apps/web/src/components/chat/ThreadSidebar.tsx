'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, UserProfile, Channel } from '@orbit/types';
import { X, Send, CornerUpLeft, Smile, SmilePlus, Type, Paperclip, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { getTopEmojis, recordEmojiUsage } from '../../lib/emojiStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { RichTextEditor, RichTextEditorRef } from './RichTextEditor';
import { FileAttachmentList, formatFileSize, getFileCategory } from './FileAttachmentList';

interface ThreadSidebarProps {
  parentMessage: Message;
  replies: Message[];
  currentUser: UserProfile | null;
  onClose: () => void;
  onReplyAdded: (reply: Message) => void;
  members?: any[];
  onSelectUserDM?: (user: UserProfile) => void;
  onSelectChannel?: (channel: Channel) => void;
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
}) => {
  const [content, setContent] = useState('');
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
  const editorRef = useRef<RichTextEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isParentAnon = !!parentMessage.isAnonymous;

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
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleReaction = async (messageId: string, emoji: string) => {
    recordEmojiUsage(emoji);
    setTopEmojis(getTopEmojis(5));
    try {
      await api.post(`/api/messages/${messageId}/reactions`, { emoji });
    } catch (err) {
      console.error('Failed to react in thread', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
  const canEditParent = !parentMessage.isDeleted && (isParentSelf || isSuperAdmin);
  const canDeleteParent = !parentMessage.isDeleted && (isParentSelf || isWsAdmin || isSuperAdmin);
  const authorName = isParentAnon
    ? (parentMessage.anonName || 'Anonymous')
    : (parentMessage.user?.displayName || parentMessage.bot?.name || 'Unknown');
  const parentAnonEmoji = parentMessage.anonEmoji || '🎭';
  const avatarUrl = parentMessage.user?.avatarUrl || parentMessage.bot?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`;

  return (
    <div className="w-full h-full bg-[#1F2326] border-l border-[#383F45]/40 flex flex-col select-none">
      {/* Thread Header */}
      <div className="h-14 border-b border-[#383F45]/40 px-4 flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">Thread</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Parent Message */}
        <div
          id={`thread-msg-${parentMessage.id}`}
          className="group relative flex gap-3 pb-3 border-b border-[#383F45]/40 p-2 rounded-lg transition-all duration-300"
        >
          {isParentAnon ? (
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-900/70 to-indigo-900/70 border border-purple-500/40 flex items-center justify-center text-base shrink-0 mt-0.5 select-none"
              title={authorName}
            >
              {parentAnonEmoji}
            </div>
          ) : (
            <img src={avatarUrl} alt={authorName} className="w-8 h-8 rounded-lg shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">{authorName}</span>
              {isParentAnon && (
                <span
                  className={`text-[9px] font-semibold px-1 py-0.2 rounded uppercase ${
                    isParentSelf
                      ? 'bg-purple-900/70 text-purple-200 border border-purple-500/40'
                      : 'bg-gray-800 text-gray-300 border border-gray-700'
                  }`}
                >
                  {isParentSelf ? 'You (Anon)' : 'Anonymous'}
                </span>
              )}
              <span className="text-[10px] text-gray-500">
                {new Date(parentMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {parentMessage.isEdited && !parentMessage.isDeleted && (
                <span className="text-[9px] italic select-none text-gray-400 font-medium">
                  (edited)
                </span>
              )}
            </div>

            {parentMessage.isDeleted ? (
              <div className="flex items-center gap-1.5 py-1 text-xs italic select-none text-gray-400">
                <Trash2 size={12} className="opacity-60 shrink-0" />
                <span>This message was deleted</span>
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
                  className="w-full text-xs p-2 rounded-lg bg-[#25292D] border border-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-slack-activeChannel resize-y"
                  placeholder="Edit message..."
                />
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>escape to cancel • enter to save</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingEdit}
                      className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-700 transition"
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
                <div className="text-xs text-gray-200 mt-1 max-w-none break-words">
                  <MarkdownRenderer
                    content={parentMessage.content}
                    currentUsername={currentUser?.username}
                    onMentionClick={handleMentionClick}
                    onChannelClick={handleChannelClick}
                  />
                </div>

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
                              : 'bg-[#2C3136]/80 hover:bg-[#3E4348] border-gray-700/60 text-gray-300'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{data.count}</span>
                        </button>
                      ))}

                      <button
                        onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2C3136]/60 hover:bg-[#3E4348] border border-gray-700/50 text-gray-400 hover:text-white transition"
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
            <div className="absolute right-2 -top-2.5 hidden group-hover:flex items-center bg-[#222529] border border-gray-700/90 rounded-xl shadow-xl px-1.5 py-0.5 gap-0.5 z-20 backdrop-blur-sm">
              {/* Top 3 Quick Reactions */}
              <div className="flex items-center gap-0.5 pr-1 border-r border-gray-700/80 mr-0.5">
                {topEmojis.slice(0, 3).map((em) => (
                  <button
                    key={em}
                    onClick={() => handleReaction(parentMessage.id, em)}
                    className="hover:scale-125 transition text-[11px] p-0.5 rounded hover:bg-gray-700/50"
                    title={`React with ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
                title="More emojis..."
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
              >
                <SmilePlus size={12} />
              </button>
              <button
                onClick={() => setReplyingToMessage(parentMessage)}
                title="Quote Reply"
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
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
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                >
                  <Pencil size={12} />
                </button>
              )}
              {canDeleteParent && (
                <button
                  onClick={() => setDeleteConfirmMessage(parentMessage)}
                  title="Delete message"
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition"
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
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </span>
          <div className="flex-1 h-px bg-[#383F45]/40" />
        </div>

        {/* Replies List */}
        {replies.map((reply, idx) => {
          const isReplyAnon = !!reply.isAnonymous || isParentAnon;
          const isReplySelf = reply.isSelf || (!isReplyAnon && reply.userId === currentUser?.id);
          const canEditReply = !reply.isDeleted && (isReplySelf || isSuperAdmin);
          const canDeleteReply = !reply.isDeleted && (isReplySelf || isWsAdmin || isSuperAdmin);
          const replyAuthor = isReplyAnon
            ? (reply.anonName || 'Anonymous')
            : (reply.user?.displayName || 'Unknown');
          const replyEmoji = reply.anonEmoji || '🎭';
          const replyAvatar = reply.user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${replyAuthor}`;

          return (
            <div
              key={reply.id}
              id={`thread-msg-${reply.id}`}
              className="group relative flex gap-3 p-2 rounded-lg hover:bg-[#222529]/60 transition-all duration-300"
            >
              {isReplyAnon ? (
                <div
                  className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-900/70 to-indigo-900/70 border border-purple-500/40 flex items-center justify-center text-sm shrink-0 mt-0.5 select-none"
                  title={replyAuthor}
                >
                  {replyEmoji}
                </div>
              ) : (
                <img src={replyAvatar} alt={replyAuthor} className="w-7 h-7 rounded-lg shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{replyAuthor}</span>
                  {isReplyAnon && (
                    <span
                      className={`text-[9px] font-semibold px-1 py-0.2 rounded uppercase ${
                        isReplySelf
                          ? 'bg-purple-900/70 text-purple-200 border border-purple-500/40'
                          : 'bg-gray-800 text-gray-300 border border-gray-700'
                      }`}
                    >
                      {isReplySelf ? 'You (Anon)' : 'Anonymous'}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500">
                    {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {reply.isEdited && !reply.isDeleted && (
                    <span className="text-[9px] italic select-none text-gray-400 font-medium">
                      (edited)
                    </span>
                  )}
                </div>

                {reply.isDeleted ? (
                  <div className="flex items-center gap-1.5 py-1 text-xs italic select-none text-gray-400">
                    <Trash2 size={12} className="opacity-60 shrink-0" />
                    <span>This message was deleted</span>
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
                      className="w-full text-xs p-2 rounded-lg bg-[#25292D] border border-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-slack-activeChannel resize-y"
                      placeholder="Edit reply..."
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>escape to cancel • enter to save</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-700 transition"
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
                        className="mt-1 mb-1 flex items-center gap-2 bg-[#25292D] hover:bg-[#2F3439] border-l-4 border-slack-green rounded-r-lg px-2.5 py-1 cursor-pointer text-xs transition max-w-full shadow-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slack-green text-[10px] block">
                            {isReplyAnon || reply.quotedMessage.isAnonymous
                              ? (reply.quotedMessage.anonName ? `${reply.quotedMessage.anonEmoji || '🎭'} ${reply.quotedMessage.anonName}` : 'Anonymous')
                              : (reply.quotedMessage.user?.displayName || 'Teammate')}
                          </span>
                          <span className="text-gray-300 text-[10px] truncate block max-w-xs">
                            {reply.quotedMessage.content}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-200 mt-0.5 max-w-none break-words">
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
                                  : 'bg-[#2C3136]/80 hover:bg-[#3E4348] border-gray-700/60 text-gray-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{data.count}</span>
                            </button>
                          ))}

                          <button
                            onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2C3136]/60 hover:bg-[#3E4348] border border-gray-700/50 text-gray-400 hover:text-white transition"
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
                <div className="absolute right-2 -top-2 hidden group-hover:flex items-center bg-[#222529] border border-gray-700/90 rounded-xl shadow-xl px-1.5 py-0.5 gap-0.5 z-20 backdrop-blur-sm">
                  {/* Top 3 Quick Reactions */}
                  <div className="flex items-center gap-0.5 pr-1 border-r border-gray-700/80 mr-0.5">
                    {topEmojis.slice(0, 3).map((em) => (
                      <button
                        key={em}
                        onClick={() => handleReaction(reply.id, em)}
                        className="hover:scale-125 transition text-[11px] p-0.5 rounded hover:bg-gray-700/50"
                        title={`React with ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                    title="More emojis..."
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                  >
                    <SmilePlus size={12} />
                  </button>
                  <button
                    onClick={() => setReplyingToMessage(reply)}
                    title="Quote Reply"
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
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
                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {canDeleteReply && (
                    <button
                      onClick={() => setDeleteConfirmMessage(reply)}
                      title="Delete reply"
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition"
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
          );
        })}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="p-3 border-t border-[#383F45]/40 bg-[#181B1E] relative">
        {/* Quote Reply Banner */}
        {replyingToMessage && (
          <div className="flex items-center justify-between bg-[#222529] border-l-4 border-slack-green rounded-t-lg px-3 py-1.5 mb-1 text-xs">
            <div className="min-w-0">
              <span className="text-slack-green font-semibold text-[11px] block">
                Replying to{' '}
                {isParentAnon || replyingToMessage.isAnonymous
                  ? replyingToMessage.anonName
                    ? `${replyingToMessage.anonEmoji || '🎭'} ${replyingToMessage.anonName}`
                    : 'Anonymous'
                  : replyingToMessage.user?.displayName || 'Teammate'}
              </span>
              <span className="text-gray-400 text-[11px] truncate block max-w-xs">
                {replyingToMessage.content}
              </span>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-gray-400 hover:text-white transition"
              title="Cancel quote reply"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendReply} className="bg-[#222529] border border-gray-700 rounded-lg relative">
          {/* Uploaded attachments preview */}
          {threadAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-[#1C1F23]/80 border-b border-gray-800">
              {threadAttachments.map((file, idx) => (
                <div
                  key={file.id || idx}
                  className="flex items-center gap-1.5 px-2 py-1 bg-[#282D32] border border-gray-700/60 rounded-md text-xs text-gray-200"
                >
                  <FileText size={12} className="text-slack-green shrink-0" />
                  <span className="truncate max-w-[120px] font-medium text-[11px]">{file.fileName}</span>
                  <span className="text-[10px] text-gray-400">({formatFileSize(file.fileSize)})</span>
                  <button
                    type="button"
                    onClick={() => setThreadAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-400 ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <RichTextEditor
            ref={editorRef}
            placeholder={isParentAnon ? 'Reply anonymously...' : 'Reply...'}
            showToolbar={showFormatting}
            mentionUsers={mentionUsers}
            minHeight="44px"
            onTyping={(text) => setContent(text)}
            onSubmit={() => handleSendReply()}
          />
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#1C1F23]/60 border-t border-gray-800/40 rounded-b-lg">
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
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition disabled:opacity-40"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin text-slack-green" /> : <Paperclip size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setShowFormatting(!showFormatting)}
                title={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                className={`p-1 rounded transition ${
                  showFormatting ? 'bg-[#383F45] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Type size={14} />
              </button>

              <button
                type="button"
                onClick={() => setShowComposerEmoji(!showComposerEmoji)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
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
          <div className="w-full max-w-sm rounded-2xl bg-[#222529] border border-gray-700 shadow-2xl p-5 space-y-4 text-white">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 shrink-0 mt-0.5">
                <Trash2 size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Delete message</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to delete this message? This message will be marked as deleted.
                </p>
              </div>
            </div>

            {deleteConfirmMessage.content && (
              <div className="p-2.5 rounded-lg bg-[#181B1E] border border-gray-700 text-xs text-gray-400 max-h-20 overflow-y-auto italic line-clamp-3">
                &ldquo;{deleteConfirmMessage.content}&rdquo;
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmMessage(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 transition"
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
    </div>
  );
};
