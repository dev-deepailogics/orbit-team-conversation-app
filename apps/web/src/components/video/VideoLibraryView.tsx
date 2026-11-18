'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Recording, UserProfile } from '@orbit/types';
import { ArrowLeft, Search, Play, Clock, Eye, ChevronDown, Film, Loader2, Video as VideoIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatDuration } from '../recording/recordingUtils';
import { RecordingPlayer } from '../recording/RecordingPlayer';

interface VideoLibraryViewProps {
  workspaceId: string;
  currentUser?: UserProfile | null;
  onClose: () => void;
}

type SortOption = 'newest' | 'oldest' | 'most_viewed';
type OwnerFilter = 'all' | 'mine';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest to oldest',
  oldest: 'Oldest to newest',
  most_viewed: 'Most viewed',
};

export const VideoLibraryView: React.FC<VideoLibraryViewProps> = ({ workspaceId, currentUser, onClose }) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [owner, setOwner] = useState<OwnerFilter>('all');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState<Recording | null>(null);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const res = await api.get<Recording[]>(`/api/recordings/workspace/${workspaceId}`, {
        params: { sort, search: search.trim() || undefined, mine: owner === 'mine' ? '1' : undefined },
      });
      setRecordings(res.data);
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchRecordings, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, sort, owner, search]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = (recording: Recording) => {
      if (recording.workspaceId === workspaceId) {
        setRecordings((prev) => [recording, ...prev.filter((r) => r.id !== recording.id)]);
      }
    };
    const onDelete = (payload: { recordingId: string; workspaceId?: string }) => {
      if (payload.workspaceId === workspaceId) {
        setRecordings((prev) => prev.filter((r) => r.id !== payload.recordingId));
      }
    };
    socket.on('recording:new', onNew);
    socket.on('recording:delete', onDelete);
    return () => {
      socket.off('recording:new', onNew);
      socket.off('recording:delete', onDelete);
    };
  }, [workspaceId]);

  const totalViews = useMemo(() => recordings.reduce((sum, r) => sum + (r.viewCount || 0), 0), [recordings]);

  const handleDeleted = (recordingId: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    setActiveRecording(null);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--theme-bg-app)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            title="Back"
            className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <VideoIcon size={20} className="text-slack-green" />
            <div>
              <h1 className="text-lg font-bold text-[var(--theme-text)] leading-tight">Video Library</h1>
              <p className="text-xs text-[var(--theme-text-muted)]">
                {recordings.length} recording{recordings.length === 1 ? '' : 's'} · {totalViews} total view{totalViews === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recordings..."
            className="w-full text-sm bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg pl-9 pr-3 py-2 text-[var(--theme-text)] focus:outline-none focus:border-slack-green"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--theme-border)]">
        <div className="relative">
          <button
            onClick={() => {
              setOwnerMenuOpen((v) => !v);
              setSortMenuOpen(false);
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
          >
            {owner === 'mine' ? 'My recordings' : 'All recordings'}
            <ChevronDown size={13} />
          </button>
          {ownerMenuOpen && (
            <div className="absolute top-full mt-1 left-0 w-40 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg shadow-xl z-10 py-1">
              {(['all', 'mine'] as OwnerFilter[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setOwner(opt);
                    setOwnerMenuOpen(false);
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--theme-bg-surface-hover)] transition ${
                    owner === opt ? 'text-slack-green font-semibold' : 'text-[var(--theme-text)]'
                  }`}
                >
                  {opt === 'mine' ? 'My recordings' : 'All recordings'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setSortMenuOpen((v) => !v);
              setOwnerMenuOpen(false);
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
          >
            {SORT_LABELS[sort]}
            <ChevronDown size={13} />
          </button>
          {sortMenuOpen && (
            <div className="absolute top-full mt-1 left-0 w-44 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg shadow-xl z-10 py-1">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSort(opt);
                    setSortMenuOpen(false);
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--theme-bg-surface-hover)] transition ${
                    sort === opt ? 'text-slack-green font-semibold' : 'text-[var(--theme-text)]'
                  }`}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-slack-green" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-2 text-[var(--theme-text-muted)]">
            <Film size={32} />
            <p className="text-sm">No recordings yet. Record a clip from any channel to see it here.</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {recordings.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setActiveRecording(rec)}
                className="group flex flex-col bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] hover:border-slack-green/60 rounded-xl overflow-hidden shadow-sm transition text-left"
              >
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {rec.thumbnailUrl ? (
                    <img
                      src={rec.thumbnailUrl}
                      alt={rec.title}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <Play size={28} className="text-white/60" />
                  )}
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {formatDuration(rec.durationSec)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <span className="text-xs font-semibold text-[var(--theme-text)] truncate" title={rec.title}>
                    {rec.title}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-[var(--theme-text-muted)]">
                    <span className="truncate">{rec.creator?.displayName || 'Unknown'}</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Eye size={10} /> {rec.viewCount}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeRecording && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveRecording(null)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <RecordingPlayer
              recording={activeRecording}
              currentUserId={currentUser?.id}
              onDeleted={handleDeleted}
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
};
