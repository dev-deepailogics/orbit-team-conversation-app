'use client';

import React from 'react';
import { Search } from '@/components/ui/icons';

/** Case-insensitive "contains" match used by every searchable dropdown. */
export const matchesSearch = (text: string | null | undefined, query: string) =>
  !query.trim() || (text || '').toLowerCase().includes(query.trim().toLowerCase());

/**
 * Search box pinned to the top of a dropdown list. Enter picks the first match (onEnter),
 * Escape closes the menu (onEscape). Place it as the first child of the scrolling menu.
 */
export const DropdownSearch: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Use when the menu has its own padding: pulls the box flush to the menu edges (p-1 → 1, p-1.5 → 1.5, p-2 → 2). */
  inset?: 1 | 1.5 | 2;
  /** Match the menu's own background so the pinned box doesn't show a different color. */
  background?: string;
}> = ({
  value,
  onChange,
  placeholder = 'Search…',
  onEnter,
  onEscape,
  autoFocus = true,
  inset = 1.5,
  background = 'var(--theme-bg-app)',
}) => {
  const insetClass = { 1: '-top-1 -mx-1 -mt-1 p-1', 1.5: '-top-1.5 -mx-1.5 -mt-1.5 p-1.5', 2: '-top-2 -mx-2 -mt-2 p-2' }[inset];
  return (
    <div
      className={`sticky ${insetClass} mb-1 border-b z-10`}
      style={{ backgroundColor: background, borderColor: 'var(--theme-border)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="h-8 px-2.5 rounded-lg flex items-center gap-2 border"
        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
      >
        <Search size={13} style={{ color: 'var(--theme-text-muted)' }} />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter?.();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              onEscape?.();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-[var(--theme-text-muted)]"
          style={{ color: 'var(--theme-text)' }}
        />
      </div>
    </div>
  );
};

export const NoMatches: React.FC<{ text?: string }> = ({ text = 'No matches' }) => (
  <p className="px-2.5 py-2 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
    {text}
  </p>
);
