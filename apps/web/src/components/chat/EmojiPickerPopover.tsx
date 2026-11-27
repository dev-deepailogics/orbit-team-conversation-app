'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { Theme, EmojiClickData, EmojiStyle } from 'emoji-picker-react';
import { Search, Sparkles, X, Grid } from '@/components/ui/icons';
import { getTopEmojis, recordEmojiUsage, POPULAR_REACTION_EMOJIS } from '../../lib/emojiStore';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  title?: string;
  /** Placement hint: a `bottom-*` class opens it above the anchor, otherwise below; `left-*` aligns it left. */
  positionClass?: string;
}

const MARGIN = 8;
const MAX_HEIGHT = 500;
// Below a message row, the picker opens just under its hover toolbar rather than under the whole (maybe tall) row
const BELOW_OFFSET = 36;

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  title = 'Add Reaction',
  positionClass = 'bottom-10 right-0',
}) => {
  const [topEmojis, setTopEmojis] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Marks where the picker was opened; its parent (a message row, a composer) is what the picker is placed against
  const anchorRef = useRef<HTMLSpanElement>(null);
  const preferAbove = /(^|\s)bottom-/.test(positionClass);
  const alignLeft = /(^|\s)left-/.test(positionClass);

  useEffect(() => {
    if (isOpen) {
      setTopEmojis(getTopEmojis(5));
      setShowFullPicker(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // The picker is portalled to <body> and placed in viewport coordinates, so a scrolling list (a thread, the channel)
  // can never clip it. It opens on the preferred side when it fits, otherwise on the roomier side (scrolling inside if
  // even that is short), stays on screen, and follows its anchor while the page or a list scrolls.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current?.parentElement;
      const el = containerRef.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const height = Math.min(el.scrollHeight, MAX_HEIGHT);
      const belowTop = a.top + Math.min(a.height, BELOW_OFFSET);
      const spaceAbove = a.top - MARGIN * 2;
      const spaceBelow = vh - belowTop - MARGIN * 2;
      const above = preferAbove
        ? spaceAbove >= height || spaceAbove >= spaceBelow
        : spaceBelow < height && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(height, above ? spaceAbove : spaceBelow));
      const top = above ? a.top - MARGIN - maxHeight : belowTop + MARGIN;
      const left = alignLeft ? a.left : a.right - el.offsetWidth - MARGIN;
      setPos({
        top: Math.min(Math.max(top, MARGIN), vh - maxHeight - MARGIN),
        left: Math.min(Math.max(left, MARGIN), vw - el.offsetWidth - MARGIN),
        maxHeight,
      });
    };
    place();
    const onScroll = (e: Event) => {
      // Scrolling inside the picker itself (its emoji grid) doesn't move it
      if (!containerRef.current?.contains(e.target as Node)) place();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, showFullPicker, preferAbove, alignLeft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePickEmoji = (emoji: string) => {
    recordEmojiUsage(emoji);
    setTopEmojis(getTopEmojis(5));
    onSelectEmoji(emoji);
    onClose();
  };

  const filteredPopular = searchQuery.trim()
    ? POPULAR_REACTION_EMOJIS.filter((em) => em.includes(searchQuery.trim()))
    : POPULAR_REACTION_EMOJIS;

  return (
    <>
    <span ref={anchorRef} hidden />
    {createPortal(
    <div
      ref={containerRef}
      // Hidden for the first layout pass, until it has been measured and placed (before the browser paints)
      style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { top: 0, left: 0, visibility: 'hidden' }}
      className="fixed z-[100] bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-2xl shadow-2xl w-80 max-w-[calc(100vw-2rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--theme-border)] bg-[var(--theme-bg-app)]">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--theme-text)]">
          <Sparkles size={14} className="text-slack-green" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFullPicker(!showFullPicker)}
            title={showFullPicker ? 'Show Quick Emojis' : 'Show All Emojis'}
            className={`p-1 rounded text-xs transition flex items-center gap-1 ${
              showFullPicker
                ? 'bg-slack-green text-white font-semibold px-2'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]'
            }`}
          >
            <Grid size={13} />
            <span className="text-[11px]">{showFullPicker ? 'Quick' : 'All Emojis'}</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showFullPicker ? (
        <div className="p-1 bg-[var(--theme-bg-app)]">
          <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            width="100%"
            height={320}
            lazyLoadEmojis={true}
            searchPlaceHolder="Search all emojis..."
            onEmojiClick={(data: EmojiClickData) => handlePickEmoji(data.emoji)}
          />
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Top 5 Most Used Section */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slack-green mb-1.5 flex items-center gap-1">
              <span>Frequently Used</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 bg-[var(--theme-bg-app)] p-1.5 rounded-xl border border-[var(--theme-border)]">
              {topEmojis.map((emoji, idx) => (
                <button
                  key={`top-${idx}-${emoji}`}
                  onClick={() => handlePickEmoji(emoji)}
                  className="h-10 text-xl flex items-center justify-center hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition hover:scale-125 duration-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box for Quick Reactions */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--theme-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter quick emojis..."
              className="w-full bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-border)]"
            />
          </div>

          {/* Popular Reactions Grid */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] mb-1.5">
              Popular Reactions
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto pr-1">
              {filteredPopular.map((emoji, idx) => (
                <button
                  key={`pop-${idx}-${emoji}`}
                  onClick={() => handlePickEmoji(emoji)}
                  className="h-8 text-base flex items-center justify-center hover:bg-[var(--theme-bg-surface-hover)] rounded-md transition hover:scale-125 duration-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Button to View Full Library */}
          <button
            onClick={() => setShowFullPicker(true)}
            className="w-full py-1.5 text-center text-xs font-medium text-[var(--theme-text)] hover:text-[var(--theme-text)] bg-[var(--theme-bg-surface)] hover:bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <Grid size={13} className="text-slack-green" />
            <span>Open All 3,000+ Emojis</span>
          </button>
        </div>
      )}
    </div>,
    document.body,
    )}
    </>
  );
};
