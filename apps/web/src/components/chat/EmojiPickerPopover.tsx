'use client';

import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Search, Sparkles, X, Grid } from 'lucide-react';
import { getTopEmojis, recordEmojiUsage, POPULAR_REACTION_EMOJIS } from '../../lib/emojiStore';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  title?: string;
  positionClass?: string;
}

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
  const [adjustedStyle, setAdjustedStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTopEmojis(getTopEmojis(5));
      setShowFullPicker(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Viewport Boundary Detection: Prevent popover from clipping at bottom or top of viewport
  useEffect(() => {
    if (!isOpen) {
      setAdjustedStyle({});
      return;
    }

    const checkPosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const styles: React.CSSProperties = {};

      // If bottom edge extends too close to or past bottom of viewport
      if (rect.bottom > viewportHeight - 16) {
        styles.bottom = '100%';
        styles.top = 'auto';
        styles.marginBottom = '8px';
      }

      // If top edge extends past top of viewport
      if (rect.top < 60) {
        styles.top = '100%';
        styles.bottom = 'auto';
        styles.marginTop = '8px';
      }

      // If right edge extends past viewport
      if (rect.right > viewportWidth - 10) {
        styles.right = '8px';
        styles.left = 'auto';
      }

      setAdjustedStyle(styles);
    };

    const timer = setTimeout(checkPosition, 0);
    window.addEventListener('resize', checkPosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkPosition);
    };
  }, [isOpen, showFullPicker]);

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
    <div
      ref={containerRef}
      style={adjustedStyle}
      className={`absolute z-50 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-2xl shadow-2xl overflow-hidden w-80 max-w-[calc(100vw-2rem)] max-h-[min(500px,calc(100vh-100px))] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 ${positionClass}`}
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
    </div>
  );
};
