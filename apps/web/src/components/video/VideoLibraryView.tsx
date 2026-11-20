'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Recording, RecordingViewedEvent, SOCKET_EVENTS, UserProfile } from '@orbit/types';
import { ArrowLeft, Search, Play, ChevronDown, Film, Loader2, Plus, Video as VideoIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatDuration } from '../recording/recordingUtils';
import { RecordingPlayer } from '../recording/RecordingPlayer';
import { RecordingViewCount } from '../recording/RecordingViewers';
import { useRecorderStore } from '../../stores/recorderStore';

const NewVideoButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3.5 py-2 bg-slack-green hover:bg-slack-green/90 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
  >
    <Plus size={15} /> New video
  </button>
);

interface VideoLibraryViewProps {
  workspaceId: string;
  currentUser?: UserProfile | null;
  onClose: () => void;
}

type SortOption = 'newest' | 'oldest' | 'most_viewed';
type OwnerFilter = 'all' | 'mine';
type LibraryPage = { recordings: Recording[]; hasMore: boolean };

const PAGE_SIZE = 48;

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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Each query gets an id; responses from superseded queries (fast typing, filter changes) are dropped
  // so an older, slower response can never overwrite newer results.
  const queryIdRef = useRef(0);

  const fetchPage = (offset: number) =>
    api.get<LibraryPage>(`/api/recordings/workspace/${workspaceId}`, {
      params: {
        sort,
        search: search.trim() || undefined,
        mine: owner === 'mine' ? '1' : undefined,
        limit: PAGE_SIZE,
        offset,
      },
    });

  useEffect(() => {
    const queryId = ++queryIdRef.current;
    setLoading(true);
    const timeout = setTimeout(() => {
      fetchPage(0)
        .then((res) => {
          if (queryId !== queryIdRef.current) return;
          setRecordings(res.data.recordings);
          setHasMore(res.data.hasMore);
        })
        .catch(() => {
          if (queryId !== queryIdRef.current) return;
          setRecordings([]);
          setHasMore(false);
        })
        .finally(() => queryId === queryIdRef.current && setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, sort, owner, search]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const queryId = queryIdRef.current;
    setLoadingMore(true);
    try {
      const res = await fetchPage(recordings.length);
      if (queryId !== queryIdRef.current) return;
      setRecordings((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.data.recordings.filter((r) => !seen.has(r.id))];
      });
      setHasMore(res.data.hasMore);
    } catch {
      /* keep what's shown; the button stays available to retry */
    } finally {
      setLoadingMore(false);
    }
  };

  // Live updates. A new clip is only inserted if it matches the active filters.
  const filtersRef = useRef({ owner, search });
  filtersRef.current = { owner, search };
  useEffect(() => {
    const socket = getSocket();
    const matches = (r: Recording) => {
      const { owner: o, search: s } = filtersRef.current;
      if (o === 'mine' && r.creatorId !== currentUser?.id) return false;
      const q = s.trim().toLowerCase();
      return !q || r.title.toLowerCase().includes(q);
    };
    const onNew = (recording: Recording) => {
      if (recording.workspaceId !== workspaceId || !matches(recording)) return;
      setRecordings((prev) => [recording, ...prev.filter((r) => r.id !== recording.id)]);
    };
    const onUpdate = (recording: Recording) => {
      if (recording.workspaceId !== workspaceId) return;
      setRecordings((prev) => prev.map((r) => (r.id === recording.id ? { ...r, ...recording } : r)));
    };
    const onDelete = (payload: { recordingId: string; workspaceId?: string }) => {
      if (payload.workspaceId !== workspaceId) return;
      setRecordings((prev) => prev.filter((r) => r.id !== payload.recordingId));
      setActiveRecording((a) => (a?.id === payload.recordingId ? null : a));
    };
    // Sent only to the creator: someone just played one of my clips.
    const onViewed = ({ recordingId, viewCount }: RecordingViewedEvent) => {
      setRecordings((prev) => prev.map((r) => (r.id === recordingId ? { ...r, viewCount } : r)));
    };
    socket.on(SOCKET_EVENTS.RECORDING_NEW, onNew);
    socket.on(SOCKET_EVENTS.RECORDING_UPDATE, onUpdate);
    socket.on(SOCKET_EVENTS.RECORDING_DELETE, onDelete);
    socket.on(SOCKET_EVENTS.RECORDING_VIEWED, onViewed);
    return () => {
      socket.off(SOCKET_EVENTS.RECORDING_NEW, onNew);
      socket.off(SOCKET_EVENTS.RECORDING_UPDATE, onUpdate);
      socket.off(SOCKET_EVENTS.RECORDING_DELETE, onDelete);
      socket.off(SOCKET_EVENTS.RECORDING_VIEWED, onViewed);
    };
  }, [workspaceId, currentUser?.id]);

  const totalViews = useMemo(() => recordings.reduce((sum, r) => sum + (r.viewCount || 0), 0), [recordings]);

  // Same recorder as the chat composer's button. The finished clip saves itself to the library and
  // appears here through the live "recording:new" update.
  const openRecorder = useRecorderStore((s) => s.open);
  const startNewVideo = () => openRecorder({ workspaceId });

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
                {recordings.length}
                {hasMore ? '+' : ''} recording{recordings.length === 1 && !hasMore ? '' : 's'} · {totalViews}
                {hasMore ? '+' : ''} view{totalViews === 1 && !hasMore ? '' : 's'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <NewVideoButton onClick={startNewVideo} />
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
            <p className="text-sm">{search.trim() ? 'No recordings match your search.' : 'No recordings yet.'}</p>
            {!search.trim() && <NewVideoButton onClick={startNewVideo} />}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {recordings.map((rec) => (
              // A div, not a <button>: the creator's view count inside is itself a button.
              <div
                key={rec.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveRecording(rec)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setActiveRecording(rec);
                  }
                }}
                className="group cursor-pointer flex flex-col bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] hover:border-slack-green/60 rounded-xl overflow-hidden shadow-sm transition text-left"
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
                    <RecordingViewCount
                      recordingId={rec.id}
                      title={rec.title}
                      viewCount={rec.viewCount}
                      isCreator={!!currentUser?.id && rec.creatorId === currentUser.id}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && hasMore && (
          <div className="flex justify-center pt-5">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition disabled:opacity-60"
            >
              {loadingMore && <Loader2 size={13} className="animate-spin" />}
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
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
