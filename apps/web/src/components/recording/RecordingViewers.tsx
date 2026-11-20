'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RecordingViewers as Viewers, RecordingViewerUser } from '@orbit/types';
import { Eye, Hash, Lock, Loader2, MessageCircle, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Avatar, relativeTime } from '../project/projectViewUtils';

const nameOf = (u: RecordingViewerUser) => u.displayName || u.username;

/**
 * View count that opens "Seen by" for the clip's creator (read-receipt style: who played it, and who
 * it was shared with that hasn't yet). Everyone else sees a plain count.
 */
export const RecordingViewCount: React.FC<{
  recordingId: string;
  title: string;
  viewCount: number;
  isCreator: boolean;
  className?: string;
}> = ({ recordingId, title, viewCount, isCreator, className = '' }) => {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      <Eye size={10} /> {viewCount}
    </>
  );
  if (!isCreator) return <span className={`flex items-center gap-1 font-mono ${className}`}>{content}</span>;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="See who watched"
        className={`flex items-center gap-1 font-mono rounded px-1 -mx-1 hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition ${className}`}
      >
        {content}
      </button>
      {open && <RecordingViewersDialog recordingId={recordingId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
};

const RecordingViewersDialog: React.FC<{ recordingId: string; title: string; onClose: () => void }> = ({
  recordingId,
  title,
  onClose,
}) => {
  const [data, setData] = useState<Viewers | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    api
      .get<Viewers>(`/api/recordings/${recordingId}/viewers`)
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err.response?.data?.error || 'Could not load viewers'));
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // A one-to-one DM reads as a yes/no ("Seen" / "Not seen yet") rather than as lists.
  const directPeer =
    data && data.sharedIn.length === 1 && data.sharedIn[0].type === 'DIRECT' && data.seen.length + data.notSeen.length === 1
      ? data.seen[0]?.user ?? data.notSeen[0]
      : null;

  // Portalled: a card's overflow-hidden or a backdrop-filter ancestor would otherwise clip or re-anchor it.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 cursor-default"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Who watched this recording"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[70vh] flex flex-col bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-2xl text-left"
      >
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-[var(--theme-border)]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--theme-text)]">Who watched</p>
            <p className="text-[11px] text-[var(--theme-text-muted)] truncate" title={title}>
              {title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!data && !error && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-slack-green" />
            </div>
          )}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-text-muted)]">
                <span className="flex items-center gap-1 font-mono">
                  <Eye size={11} /> {data.viewCount} play{data.viewCount === 1 ? '' : 's'}
                </span>
                <span>·</span>
                {data.sharedIn.length === 0 ? (
                  <span>Only in the Video Library</span>
                ) : (
                  <>
                    <span>Shared in</span>
                    {data.sharedIn.map((c) => (
                      <span
                        key={c.id}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                      >
                        {c.type === 'PUBLIC' ? <Hash size={10} /> : c.type === 'PRIVATE' ? <Lock size={10} /> : <MessageCircle size={10} />}
                        {c.name}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {directPeer ? (
                <ViewerRow
                  user={directPeer}
                  detail={data.seen[0] ? `Seen ${relativeTime(data.seen[0].lastViewedAt)}` : 'Not seen yet'}
                  seen={!!data.seen[0]}
                />
              ) : (
                <>
                  <Section label={`Seen (${data.seen.length})`}>
                    {data.seen.length === 0 && <Empty>Nobody has watched it yet.</Empty>}
                    {data.seen.map((v) => (
                      <ViewerRow
                        key={v.user.id}
                        user={v.user}
                        seen
                        detail={`${relativeTime(v.lastViewedAt)}${v.plays > 1 ? ` · ${v.plays} plays` : ''}`}
                      />
                    ))}
                  </Section>
                  {data.sharedIn.length > 0 && (
                    <Section label={`Not seen yet (${data.notSeen.length})`}>
                      {data.notSeen.length === 0 && <Empty>Everyone it was shared with has watched it.</Empty>}
                      {data.notSeen.map((u) => (
                        <ViewerRow key={u.id} user={u} seen={false} />
                      ))}
                    </Section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">{label}</p>
    {children}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-[var(--theme-text-muted)] py-1">{children}</p>
);

const ViewerRow: React.FC<{ user: RecordingViewerUser; seen: boolean; detail?: string }> = ({ user, seen, detail }) => (
  <div className={`flex items-center gap-2.5 py-1 ${seen ? '' : 'opacity-60'}`}>
    <Avatar name={nameOf(user)} src={user.avatarUrl} size={26} />
    <span className="flex-1 min-w-0 text-xs text-[var(--theme-text)] truncate">{nameOf(user)}</span>
    {detail && <span className="text-[10px] text-[var(--theme-text-muted)] shrink-0">{detail}</span>}
  </div>
);
