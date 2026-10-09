'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, UserProfile } from '@orbit/types';
import { X, Send, CornerUpLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../../lib/api';

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
  const repliesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/messages/${parentMessage.id}/replies`, {
        content: content.trim(),
        quotedMessageId: replyingToMessage?.id,
      });
      onReplyAdded(res.data);
      setContent('');
      setReplyingToMessage(null);
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
            <div className="text-xs text-gray-200 mt-1 prose prose-invert max-w-none break-words">
              <ReactMarkdown>{parentMessage.content}</ReactMarkdown>
            </div>
          </div>

          {/* Quick quote action for parent message */}
          <div className="absolute right-2 top-1 hidden group-hover:flex items-center bg-[#222529] border border-gray-700 rounded shadow-md px-1 py-0.5 z-10">
            <button
              onClick={() => setReplyingToMessage(parentMessage)}
              title="Quote Reply"
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
            >
              <CornerUpLeft size={13} />
            </button>
          </div>
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

                <div className="text-xs text-gray-200 mt-0.5 prose prose-invert max-w-none break-words">
                  <ReactMarkdown>{reply.content}</ReactMarkdown>
                </div>
              </div>

              {/* Quick quote action for reply */}
              <div className="absolute right-2 top-1 hidden group-hover:flex items-center bg-[#222529] border border-gray-700 rounded shadow-md px-1 py-0.5 z-10">
                <button
                  onClick={() => setReplyingToMessage(reply)}
                  title="Quote Reply"
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition"
                >
                  <CornerUpLeft size={13} />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="p-3 border-t border-[#383F45]/40 bg-[#181B1E]">
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

        <form onSubmit={handleSendReply} className="bg-[#222529] border border-gray-700 rounded-lg overflow-hidden">
          <textarea
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply(e);
              }
            }}
            placeholder="Reply..."
            className="w-full bg-transparent px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-end px-2 py-1.5 bg-[#1C1F23]/60 border-t border-gray-800/40">
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="p-1 bg-slack-green hover:bg-[#008a65] text-white rounded transition disabled:opacity-30"
            >
              <Send size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
