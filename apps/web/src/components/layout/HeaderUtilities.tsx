'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Channel } from '@orbit/types';
import { Bell, HelpCircle, Hash, Lock, Mask } from '@/components/ui/icons';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { SearchOrbitButton } from '../project/docsCanvasUi';
import { Avatar } from '../project/projectViewUtils';

// Figma header utilities: "Search Orbit" field, unread bell and help.
// The bell counts real unread messages (the same counts the sidebar shows) and lists those conversations.
export const HeaderUtilities: React.FC<{
  onOpenSearch?: () => void;
  onOpenChannel?: (channel: Channel) => void;
}> = ({ onOpenSearch, onOpenChannel }) => {
  const channels = useChatStore((s) => s.channels);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const meId = useAuthStore((s) => s.user?.id);
  const [open, setOpen] = useState<'bell' | 'help' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = channels
    .map((c) => ({ channel: c, count: unreadCounts[c.id] || 0 }))
    .filter((u) => u.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = unread.reduce((n, u) => n + u.count, 0);

  const isDirect = (c: Channel) => c.type === 'DIRECT' || (c.type as string) === 'GROUP_DIRECT';
  const peer = (c: Channel) => c.members?.find((m) => m.userId !== meId)?.user;
  const label = (c: Channel) => (isDirect(c) ? peer(c)?.displayName || c.name : c.name);

  const panelStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-bg-app)',
    borderColor: 'var(--theme-border)',
    boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
  };
  const iconBtn = (active: boolean) =>
    `w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)] ${
      active ? 'bg-[var(--theme-fill)]' : ''
    }`;

  return (
    <div ref={ref} className="relative flex items-center gap-2 shrink-0">
      {onOpenSearch && <SearchOrbitButton onClick={onOpenSearch} />}

      <button
        type="button"
        onClick={() => setOpen((o) => (o === 'bell' ? null : 'bell'))}
        title={total ? `${total} unread` : 'No unread messages'}
        className={`relative ${iconBtn(open === 'bell')}`}
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <Bell size={20} />
        {total > 0 && (
          <span
            className="absolute left-[18px] top-1.5 min-w-4 h-4 px-1 rounded-lg border-2 flex items-center justify-center text-[10px] font-bold leading-none"
            style={{
              backgroundColor: 'var(--theme-primary)',
              color: 'var(--theme-primary-text)',
              borderColor: 'var(--theme-bg-app)',
            }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => (o === 'help' ? null : 'help'))}
        title="Help"
        className={iconBtn(open === 'help')}
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <HelpCircle size={20} />
      </button>

      {open === 'bell' && (
        <div className="absolute right-0 top-full mt-1.5 w-[300px] rounded-[14px] border p-2 z-50" style={panelStyle}>
          <p className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
            UNREAD
          </p>
          {unread.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto flex flex-col gap-0.5">
              {unread.map(({ channel, count }) => (
                <button
                  key={channel.id}
                  type="button"
                  disabled={!onOpenChannel}
                  onClick={() => {
                    setOpen(null);
                    onOpenChannel?.(channel);
                  }}
                  className="w-full h-10 px-2.5 rounded-[10px] flex items-center gap-2.5 text-left transition hover:bg-[var(--theme-fill-hover)] disabled:cursor-default"
                >
                  <span className="w-6 h-6 flex items-center justify-center shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                    {isDirect(channel) ? (
                      <Avatar name={label(channel)} src={peer(channel)?.avatarUrl} size={24} />
                    ) : channel.isAnonymous ? (
                      <Mask size={16} />
                    ) : channel.type === 'PRIVATE' ? (
                      <Lock size={16} />
                    ) : (
                      <Hash size={16} />
                    )}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                    {label(channel)}
                  </span>
                  <span
                    className="min-w-[22px] h-5 px-1.5 rounded-[10px] flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-primary-text)' }}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {open === 'help' && (
        <div className="absolute right-0 top-full mt-1.5 w-[260px] rounded-[14px] border p-2 z-50" style={panelStyle}>
          <p className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
            KEYBOARD SHORTCUTS
          </p>
          {[
            ['Search Orbit', 'Ctrl K'],
            ['Close a dialog', 'Esc'],
            ['Send message', 'Enter'],
            ['New line', 'Shift Enter'],
          ].map(([what, keys]) => (
            <div key={what} className="h-9 px-2.5 flex items-center justify-between text-[13px]">
              <span style={{ color: 'var(--theme-text)' }}>{what}</span>
              <kbd
                className="px-1.5 py-0.5 rounded-md border text-[11px] font-medium font-sans"
                style={{ borderColor: 'color-mix(in srgb, var(--theme-text) 20%, transparent)', color: 'var(--theme-text-muted)' }}
              >
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
