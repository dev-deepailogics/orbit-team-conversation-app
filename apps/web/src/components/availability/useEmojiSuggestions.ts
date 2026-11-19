'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { loadEmojiIndex, suggestEmojis } from '../../lib/emojiSuggest';

type EmojiIndex = Awaited<ReturnType<typeof loadEmojiIndex>>;

/** Emoji suggestions for free text. The keyword index is only fetched once `enabled` is true. */
export function useEmojiSuggestions(text: string, enabled: boolean, limit = 6): string[] {
  const [index, setIndex] = useState<EmojiIndex | null>(null);
  const deferredText = useDeferredValue(text);

  useEffect(() => {
    if (!enabled || index) return;
    let alive = true;
    loadEmojiIndex()
      .then((data) => alive && setIndex(data))
      .catch((err) => console.error('Failed to load emoji keywords:', err));
    return () => {
      alive = false;
    };
  }, [enabled, index]);

  return useMemo(
    () => (enabled && index ? suggestEmojis(index, deferredText, limit) : []),
    [enabled, index, deferredText, limit],
  );
}
