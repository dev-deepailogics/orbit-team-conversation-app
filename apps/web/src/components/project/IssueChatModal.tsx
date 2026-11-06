'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Mic, User } from 'lucide-react';
import { api } from '../../lib/api';
import { UserProfile } from '@orbit/types';

interface IssueChatModalProps {
  projectId: string;
  ticket: any;
  currentUser: UserProfile | null;
  onClose: () => void;
}

export const IssueChatModal: React.FC<IssueChatModalProps> = ({
  projectId,
  ticket,
  currentUser,
  onClose,
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/projects/${projectId}/tickets/${ticket.id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error('Failed to load ticket comments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newText.trim() || isSending) return;

    try {
      setIsSending(true);
      const res = await api.post(`/api/projects/${projectId}/tickets/${ticket.id}/comments`, {
        text: newText.trim(),
        type: 'text',
      });
      setComments((prev) => [...prev, res.data]);
      setNewText('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send comment');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col h-[580px] overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-bg-surface, #1e293b)',
          borderColor: 'var(--theme-border, #334155)',
          color: 'var(--theme-text-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0 gap-3"
          style={{ borderColor: 'var(--theme-border, #334155)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-sm font-bold truncate">
              Issue Chat: <span className="font-normal opacity-90">{ticket.title}</span>
            </h3>
            {comments.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white shrink-0">
                {comments.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition p-1 rounded-lg hover:bg-[var(--theme-bg-surface-hover)] shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-[var(--theme-text-muted)]">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--theme-text-muted)]">
              <p className="text-xs">No discussion messages on this issue yet.</p>
              <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">Start the conversation below.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const authorName = comment.user?.displayName || comment.username || 'Team Member';
              const avatar =
                comment.user?.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`;
              const timeFormatted = new Date(comment.createdAt).toLocaleString(undefined, {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <div key={comment.id} className="flex items-start gap-3 text-xs">
                  <img
                    src={avatar}
                    alt={authorName}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{authorName}</span>
                      <span className="text-[11px] text-[var(--theme-text-muted)]">{timeFormatted}</span>
                    </div>

                    <div
                      className="inline-block px-3.5 py-2 rounded-2xl rounded-tl-sm text-xs break-words max-w-[85%] border shadow-xs"
                      style={{
                        backgroundColor: 'var(--theme-bg-app, #0f172a)',
                        borderColor: 'var(--theme-border, #334155)',
                        color: 'var(--theme-text-primary, #ffffff)',
                      }}
                    >
                      {comment.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div
          className="p-3 border-t shrink-0"
          style={{ borderColor: 'var(--theme-border, #334155)' }}
        >
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              title="Voice recording"
              className="p-2.5 rounded-xl border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition shrink-0"
            >
              <Mic size={16} />
            </button>

            <textarea
              rows={1}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] text-xs focus:outline-none focus:border-blue-500 transition resize-none max-h-24"
            />

            <button
              type="submit"
              disabled={!newText.trim() || isSending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--theme-bg-surface)] hover:bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] font-semibold text-xs transition disabled:opacity-40 shrink-0 shadow-sm"
            >
              <Send size={14} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
