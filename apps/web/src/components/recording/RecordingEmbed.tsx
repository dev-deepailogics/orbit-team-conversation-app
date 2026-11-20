'use client';

import React, { useEffect, useState } from 'react';
import { Recording } from '@orbit/types';
import { Play, Clock, VideoOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { clipShareUrl, formatDuration } from './recordingUtils';
import { RecordingPlayer } from './RecordingPlayer';

interface RecordingEmbedProps {
  shareSlug: string;
  currentUserId?: string | null;
}

/** Lazily loaded inline chat embed for a `/clip/:shareSlug` link — click to expand into a real player. */
export const RecordingEmbed: React.FC<RecordingEmbedProps> = ({ shareSlug, currentUserId: currentUserIdProp }) => {
  // Chat markdown doesn't know the viewer; the creator needs it for "Who watched" and to not count own plays.
  const signedInUserId = useAuthStore((s) => s.user?.id);
  const currentUserId = currentUserIdProp ?? signedInUserId;
  const [recording, setRecording] = useState<Recording | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Never render nothing: a message whose only content is this embed would look empty.
  const [failure, setFailure] = useState<'deleted' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecording(null);
    setFailure(null);
    api
      .get<Recording>(`/api/recordings/share/${shareSlug}`)
      .then((res) => {
        if (!cancelled) setRecording(res.data);
      })
      .catch((err) => {
        if (!cancelled) setFailure(err?.response?.status === 404 ? 'deleted' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  const cardClass =
    'max-w-md flex items-center gap-3 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl overflow-hidden shadow-sm';

  if (failure === 'deleted') {
    return (
      <span className={`${cardClass} px-3 py-2.5 text-xs italic text-[var(--theme-text-muted)]`}>
        <VideoOff size={14} className="shrink-0" /> This recording was deleted
      </span>
    );
  }
  if (failure === 'error') {
    const url = clipShareUrl(shareSlug);
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-[#36C5F0] hover:underline break-all">
        {url}
      </a>
    );
  }
  if (!recording) {
    return (
      <span className={`${cardClass} animate-pulse`} aria-label="Loading recording">
        <span className="w-28 h-16 bg-[var(--theme-bg-surface-hover)]" />
        <span className="flex flex-col gap-1.5 py-2 pr-3">
          <span className="w-32 h-2.5 rounded bg-[var(--theme-bg-surface-hover)]" />
          <span className="w-12 h-2 rounded bg-[var(--theme-bg-surface-hover)]" />
        </span>
      </span>
    );
  }

  if (expanded) {
    return <RecordingPlayer recording={recording} currentUserId={currentUserId} autoPlay />;
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="max-w-md flex items-center gap-3 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] hover:border-slack-green/60 rounded-xl overflow-hidden shadow-sm transition text-left"
    >
      <div className="relative w-28 h-16 flex-shrink-0 bg-black flex items-center justify-center">
        {recording.thumbnailUrl ? (
          <img src={recording.thumbnailUrl} alt={recording.title} className="w-full h-full object-cover" />
        ) : (
          <Play size={20} className="text-white/70" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition">
          <Play size={18} className="text-white drop-shadow" fill="white" />
        </div>
      </div>
      <div className="flex flex-col min-w-0 py-2 pr-3">
        <span className="text-xs font-semibold text-[var(--theme-text)] truncate">{recording.title}</span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)] font-mono mt-0.5">
          <Clock size={10} /> {formatDuration(recording.durationSec)}
        </span>
      </div>
    </button>
  );
};
