'use client';

import React, { useState } from 'react';
import { Forward, Hash, Lock, Loader2, User, X } from 'lucide-react';
import { Channel, Message, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';

interface ForwardMessageDialogProps {
  message: Message;
  currentUser: UserProfile | null;
  onClose: () => void;
}

const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

// A forward is a new message in the target channel that copies the original and quotes it for attribution (see
// verifyQuotable on the server). The note is sent first as its own message, since the forward's content is the copy.
export const ForwardMessageDialog: React.FC<ForwardMessageDialogProps> = ({ message, currentUser, onClose }) => {
  const channels = useChatStore((s) => s.channels);
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const label = (c: Channel) => {
    if (!isDirect(c)) return c.name;
    const others = (c.members || []).filter((m) => m.userId !== currentUser?.id).map((m) => m.user?.displayName);
    return others.filter(Boolean).join(', ') || `${currentUser?.displayName || 'You'} (you)`;
  };

  const q = search.trim().toLowerCase();
  const targets = channels.filter(
    (c) => !c.isArchived && c.id !== message.channelId && (!q || label(c).toLowerCase().includes(q))
  );

  const forward = async () => {
    if (!targetId) return;
    setSending(true);
    setError('');
    try {
      if (note.trim()) await api.post(`/api/channels/${targetId}/messages`, { content: note.trim() });
      await api.post(`/api/channels/${targetId}/messages`, { quotedMessageId: message.id });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to forward message');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-title"
        className="relative w-full max-w-md bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
      >
        <div className="p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-app)] flex items-center justify-between">
          <h2 id="forward-title" className="text-base font-bold text-[var(--theme-text)] flex items-center gap-2">
            <Forward size={18} /> Forward message
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 min-h-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels and people"
            aria-label="Search channels and people"
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] outline-none focus:border-slack-activeChannel"
          />

          <ul className="overflow-y-auto max-h-60 -mx-1" role="listbox" aria-label="Forward to">
            {targets.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-[var(--theme-text-muted)]">No matching conversations</li>
            )}
            {targets.map((c) => {
              const Icon = isDirect(c) ? User : c.type === 'PRIVATE' ? Lock : Hash;
              return (
                <li key={c.id} role="option" aria-selected={targetId === c.id}>
                  <button
                    onClick={() => setTargetId(c.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition ${
                      targetId === c.id
                        ? 'bg-slack-activeChannel text-white'
                        : 'text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{label(c)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            className="border-l-4 border-slack-green rounded-r-lg px-3 py-1.5 text-xs bg-[var(--theme-bg-app)]"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <span className="font-bold text-slack-green block">{message.user?.displayName || 'Teammate'}</span>
            <span className="line-clamp-3 whitespace-pre-wrap">
              {message.content || `${message.attachments?.length || 0} attachment(s)`}
            </span>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a message (optional)"
            aria-label="Add a message"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] outline-none resize-none focus:border-slack-activeChannel"
          />

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="p-4 pt-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
          >
            Cancel
          </button>
          <button
            onClick={forward}
            disabled={!targetId || sending}
            className="px-3 py-1.5 text-sm rounded-lg bg-slack-green text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 transition"
          >
            {sending && <Loader2 size={14} className="animate-spin" />} Forward
          </button>
        </div>
      </div>
    </div>
  );
};
