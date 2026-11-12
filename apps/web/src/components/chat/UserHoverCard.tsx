'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MessageSquare, Headphones } from 'lucide-react';
import { Presence, PRESENCE_STYLE } from '../availability/useTeamPresence';

interface HoverUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

interface UserHoverCardProps {
  user: HoverUser;
  presence: Presence;
  isSelf?: boolean;
  onMessage?: () => void;
  onHuddle?: () => void;
  className?: string;
  children: React.ReactNode;
}

const OPEN_DELAY = 350;
const CLOSE_DELAY = 150;
const CARD_WIDTH = 320;

/** Slack-style profile card shown while hovering a message author's avatar or name. */
export const UserHoverCard: React.FC<UserHoverCardProps> = ({ user, presence, isSelf, onMessage, onHuddle, className = 'inline-flex', children }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  const schedule = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const open = () =>
    schedule(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_WIDTH - 8));
      // Open below the trigger, or above it when there isn't room.
      setPos(
        window.innerHeight - r.bottom > 260
          ? { left, top: r.bottom + 6 }
          : { left, bottom: window.innerHeight - r.top + 6 },
      );
    }, OPEN_DELAY);
  const close = () => schedule(() => setPos(null), CLOSE_DELAY);

  // Fixed-position card would drift from its trigger on scroll; just close it.
  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [pos]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const act = (fn?: () => void) => () => {
    setPos(null);
    fn?.();
  };

  const avatar = user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
  const btn =
    'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--theme-border)] text-sm font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition';

  return (
    <>
      <span ref={triggerRef} onMouseEnter={open} onMouseLeave={close} className={className}>
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            role="dialog"
            aria-label={`${user.displayName} profile`}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={close}
            className="fixed z-50 rounded-xl border border-[var(--theme-border)] shadow-2xl animate-in fade-in zoom-in-95 duration-100"
            style={{ ...pos, width: CARD_WIDTH, backgroundColor: 'var(--theme-bg-surface)' }}
          >
            <div className="flex items-center gap-4 p-4">
              <img src={avatar} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-[15px] text-[var(--theme-text)] flex items-center gap-2">
                  <span className="truncate">{user.displayName}</span>
                  <span
                    title={PRESENCE_STYLE[presence].label}
                    className={`w-2 h-2 rounded-full shrink-0 ${PRESENCE_STYLE[presence].dot}`}
                    style={{ boxShadow: '0 0 0 1.5px var(--theme-bg-surface)' }}
                  />
                </p>
                <p className="text-sm text-[var(--theme-text-muted)] truncate">@{user.username}</p>
              </div>
            </div>

            <div className="border-t border-[var(--theme-border)] p-4 space-y-3">
              <p className="flex items-center gap-2.5 text-sm text-[var(--theme-text)]">
                <Clock size={16} className="text-[var(--theme-text-muted)]" />
                {PRESENCE_STYLE[presence].label}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={act(onMessage)} className={btn}>
                  <MessageSquare size={15} /> Message
                </button>
                {!isSelf && (
                  <button type="button" onClick={act(onHuddle)} className={btn}>
                    <Headphones size={15} /> Huddle
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
