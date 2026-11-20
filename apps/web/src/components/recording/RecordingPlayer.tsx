'use client';

import React, { useRef, useState } from 'react';
import { Recording } from '@orbit/types';
import { Copy, Check, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration, clipShareUrl } from './recordingUtils';
import { RecordingViewCount } from './RecordingViewers';

interface RecordingPlayerProps {
  recording: Recording;
  currentUserId?: string | null;
  onDeleted?: (recordingId: string) => void;
  autoPlay?: boolean;
}

export const RecordingPlayer: React.FC<RecordingPlayerProps> = ({
  recording,
  currentUserId,
  onDeleted,
  autoPlay = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [views, setViews] = useState(recording.viewCount);
  const countedRef = useRef(false);

  const isCreator = !!currentUserId && recording.creatorId === currentUserId;

  // A view is a real playback, counted once per player, not a page load or a chat embed rendering.
  // The request carries the session token when signed in, which puts the viewer on the creator's
  // "Seen by" list; the creator's own plays aren't counted (the server skips them too).
  const handlePlay = () => {
    if (countedRef.current) return;
    countedRef.current = true;
    if (!isCreator) setViews((v) => v + 1);
    api.post(`/api/recordings/share/${recording.shareSlug}/view`).catch(() => {});
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(clipShareUrl(recording.shareSlug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard access denied — nothing to recover from client-side */
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    try {
      setDeleting(true);
      await api.delete(`/api/recordings/${recording.id}`);
      onDeleted?.(recording.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete recording');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = isCreator;

  return (
    <div className="max-w-md bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-lg">
      <video
        controls
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onPlay={handlePlay}
        poster={recording.thumbnailUrl || undefined}
        src={recording.attachment.fileUrl}
        className="w-full max-h-80 bg-black"
      />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-[var(--theme-text)] truncate" title={recording.title}>
            {recording.title}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-[var(--theme-text-muted)] font-mono">
            <span>{formatDuration(recording.durationSec)}</span>
            <RecordingViewCount recordingId={recording.id} title={recording.title} viewCount={views} isCreator={isCreator} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyLink}
            title="Copy share link"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
          >
            {copied ? <Check size={14} className="text-slack-green" /> : <Copy size={14} />}
          </button>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete recording"
              className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
