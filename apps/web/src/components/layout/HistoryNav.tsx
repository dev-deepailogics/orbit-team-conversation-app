'use client';

import React, { useEffect, useState } from 'react';
import type { Channel } from '@orbit/types';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { useCanNavigate, useNavHistoryStore } from '../../stores/navHistoryStore';

const PC_KEYS = { back: 'Alt ←', forward: 'Alt →' };
const MAC_KEYS = { back: '⌘[', forward: '⌘]' };

/** Shortcut labels for this platform (read after mount, so server and client render the same first). */
export const useHistoryShortcuts = () => {
  const [keys, setKeys] = useState(PC_KEYS);
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setKeys(MAC_KEYS);
  }, []);
  return keys;
};

/** Back / forward arrows through recently opened conversations (shortcuts are handled once, in the app shell). */
export const HistoryNav: React.FC<{ onOpen: (channel: Channel) => void }> = ({ onOpen }) => {
  const { canGoBack, canGoForward } = useCanNavigate();
  const keys = useHistoryShortcuts();
  const go = (direction: -1 | 1) => {
    const channel = useNavHistoryStore.getState().go(direction);
    if (channel) onOpen(channel);
  };

  const button = (direction: -1 | 1, enabled: boolean, label: string, shortcut: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => go(direction)}
      disabled={!enabled}
      title={`${label} (${shortcut})`}
      aria-label={label}
      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-default"
      style={{ color: 'var(--theme-text)' }}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center shrink-0">
      {button(-1, canGoBack, 'Back', keys.back, <ArrowLeft size={16} />)}
      {button(1, canGoForward, 'Forward', keys.forward, <ArrowRight size={16} />)}
    </div>
  );
};
