'use client';

import React, { useEffect, useState } from 'react';
import { Recording } from '@orbit/types';
import { Play, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration } from './recordingUtils';
import { RecordingPlayer } from './RecordingPlayer';

interface RecordingEmbedProps {
  shareSlug: string;
  currentUserId?: string | null;
}

/** Lazily loaded inline chat embed for a `/clip/:shareSlug` link — click to expand into a real player. */
export const RecordingEmbed: React.FC<RecordingEmbedProps> = ({ shareSlug, currentUserId }) => {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Recording>(`/api/recordings/share/${shareSlug}`)
      .then((res) => {
        if (!cancelled) setRecording(res.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  if (failed || !recording) return null;

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
