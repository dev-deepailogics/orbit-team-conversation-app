'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, UserProfile } from '@orbit/types';
import { X, Send, CornerUpLeft, Smile, SmilePlus, Type, Paperclip, FileText, Loader2 } from 'lucide-react';
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
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  parentMessage,
  replies,
  currentUser,
  onClose,
  onReplyAdded,
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
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      if (parentMessage.channelId) {
        formData.append('channelId', parentMessage.channelId);
      }

      const res = await api.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data && res.data.attachments) {
        setThreadAttachments((prev) => [...prev, ...res.data.attachments]);
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

  const authorName = parentMessage.user?.displayName || parentMessage.bot?.name || 'Unknown';
  const avatarUrl = parentMessage.user?.avatarUrl || parentMessage.bot?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`;

  return (
    <div className="w-80 md:w-96 bg-[#1F2326] border-l border-[#383F45]/40 flex flex-col h-full select-none z-20">
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
          <img src={avatarUrl} alt={authorName} className="w-8 h-8 rounded-lg shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">{authorName}</span>
              <span className="text-[10px] text-gray-500">
                {new Date(parentMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-xs text-gray-200 mt-1 max-w-none break-words">
              <MarkdownRenderer content={parentMessage.content} />
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

            {/* Parent Message Reactions */}
            {(() => {
              const reactionCounts = (parentMessage.reactions || []).reduce(
                (acc: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } }, r) => {
                  if (!acc[r.emoji]) {
                    acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                  }
                  acc[r.emoji].count += 1;
                  if (r.user?.displayName) acc[r.emoji].users.push(r.user.displayName);
                  if (r.userId === currentUser?.id) acc[r.emoji].hasReacted = true;
                  return acc;
                },
                {}
              );

              return (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {Object.entries(reactionCounts).map(([emoji, data]) => (
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
                  {/* Top 5 Quick Reaction on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition ml-1">
                    {topEmojis.map((em) => (
                      <button
                        key={em}
                        onClick={() => handleReaction(parentMessage.id, em)}
                        className="hover:scale-125 transition text-[11px] p-0.5"
                        title={`React with ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
                      className="p-0.5 text-gray-400 hover:text-white rounded transition text-[11px]"
                      title="More emojis..."
                    >
                      <SmilePlus size={11} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quick quote action for parent message */}
          <div className="absolute right-2 top-1 hidden group-hover:flex items-center bg-[#222529] border border-gray-700 rounded shadow-md px-1 py-0.5 gap-1 z-10">
            <button
              onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === parentMessage.id ? null : parentMessage.id)}
              title="React with emoji"
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
            >
              <SmilePlus size={13} />
            </button>
            <button
              onClick={() => setReplyingToMessage(parentMessage)}
              title="Quote Reply"
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
            >
              <CornerUpLeft size={13} />
            </button>
          </div>

          {/* Anchored Mini Emoji Popover */}
          {activeEmojiMessageId === parentMessage.id && (
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
        {replies.map((reply) => {
          const replyAuthor = reply.user?.displayName || 'Unknown';
          const replyAvatar = reply.user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${replyAuthor}`;

          return (
            <div
              key={reply.id}
              id={`thread-msg-${reply.id}`}
              className="group relative flex gap-3 p-2 rounded-lg hover:bg-[#222529]/60 transition-all duration-300"
            >
              <img src={replyAvatar} alt={replyAuthor} className="w-7 h-7 rounded-lg shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{replyAuthor}</span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Quoted Message in Thread */}
                {reply.quotedMessage && (
                  <div
                    onClick={() => scrollToMessage(reply.quotedMessage!.id)}
                    className="mt-1 mb-1 flex items-center gap-2 bg-[#25292D] hover:bg-[#2F3439] border-l-4 border-slack-green rounded-r-lg px-2.5 py-1 cursor-pointer text-xs transition max-w-full shadow-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slack-green text-[10px] block">
                        {reply.quotedMessage.user?.displayName || 'Teammate'}
                      </span>
                      <span className="text-gray-300 text-[10px] truncate block max-w-xs">
                        {reply.quotedMessage.content}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-200 mt-0.5 max-w-none break-words">
                  <MarkdownRenderer content={reply.content} />
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

                {/* Reply Reactions */}
                {(() => {
                  const reactionCounts = (reply.reactions || []).reduce(
                    (acc: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } }, r) => {
                      if (!acc[r.emoji]) {
                        acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                      }
                      acc[r.emoji].count += 1;
                      if (r.user?.displayName) acc[r.emoji].users.push(r.user.displayName);
                      if (r.userId === currentUser?.id) acc[r.emoji].hasReacted = true;
                      return acc;
                    },
                    {}
                  );

                  return (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {Object.entries(reactionCounts).map(([emoji, data]) => (
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
                      {/* Top 5 Quick Reaction on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition ml-1">
                        {topEmojis.map((em) => (
                          <button
                            key={em}
                            onClick={() => handleReaction(reply.id, em)}
                            className="hover:scale-125 transition text-[11px] p-0.5"
                            title={`React with ${em}`}
                          >
                            {em}
                          </button>
                        ))}
                        <button
                          onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                          className="p-0.5 text-gray-400 hover:text-white rounded transition text-[11px]"
                          title="More emojis..."
                        >
                          <SmilePlus size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Quick actions for reply */}
              <div className="absolute right-2 top-1 hidden group-hover:flex items-center bg-[#222529] border border-gray-700 rounded shadow-md px-1 py-0.5 gap-1 z-10">
                <button
                  onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === reply.id ? null : reply.id)}
                  title="React with emoji"
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                >
                  <SmilePlus size={13} />
                </button>
                <button
                  onClick={() => setReplyingToMessage(reply)}
                  title="Quote Reply"
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                >
                  <CornerUpLeft size={13} />
                </button>
              </div>

              {/* Anchored Mini Emoji Popover */}
              {activeEmojiMessageId === reply.id && (
                <EmojiPickerPopover
                  isOpen={true}
                  onClose={() => setActiveEmojiMessageId(null)}
                  onSelectEmoji={(emoji) => handleReaction(reply.id, emoji)}
                  title="React in Thread"
                  positionClass="top-8 right-2"
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
                Replying to {replyingToMessage.user?.displayName || 'Teammate'}
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

        <form onSubmit={handleSendReply} className="bg-[#222529] border border-gray-700 rounded-lg overflow-hidden relative">
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
            placeholder="Reply..."
            showToolbar={showFormatting}
            minHeight="44px"
            onTyping={(text) => setContent(text)}
            onSubmit={() => handleSendReply()}
          />
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#1C1F23]/60 border-t border-gray-800/40">
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
            positionClass="bottom-12 left-2"
          />
        </form>
      </div>
    </div>
  );
};
