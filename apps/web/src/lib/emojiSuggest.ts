// Keyword -> emoji suggestions, reusing the English dataset that ships with emoji-picker-react
// (the same emojis our picker shows). The ~240KB JSON is loaded lazily on first use.

interface IndexedEmoji {
  emoji: string;
  keywords: string[];
}

interface RawEmoji {
  n: string[]; // names / keywords
  u: string; // unified code points, e.g. "1f468-200d-1f373"
  a: string; // Unicode version it was added in
}

// Newer emojis render as tofu on many OSes; stay within widely supported versions.
const MAX_EMOJI_VERSION = 14;
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'back', 'will', 'from', 'out', 'off', 'min', 'mins', 'some', 'have', 'going']);

let indexPromise: Promise<IndexedEmoji[]> | null = null;

const toNative = (unified: string) =>
  unified
    .split('-')
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join('');

export function loadEmojiIndex(): Promise<IndexedEmoji[]> {
  indexPromise ??= import('emoji-picker-react/dist/data/emojis-en.json')
    .then((mod) => {
      const groups = (mod.default ?? mod).emojis as Record<string, RawEmoji[]>;
      return Object.values(groups)
        .flat()
        .filter((e) => parseFloat(e.a) <= MAX_EMOJI_VERSION)
        .map((e) => ({ emoji: toNative(e.u), keywords: e.n.map((k) => k.toLowerCase()) }));
    })
    .catch((err) => {
      indexPromise = null; // allow a retry on the next call
      throw err;
    });
  return indexPromise;
}

const queryWords = (text: string) =>
  Array.from(new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? [])).filter((w) => !STOP_WORDS.has(w));

const scoreKeyword = (word: string, keyword: string) => {
  if (keyword === word) return 4;
  if (keyword.startsWith(word)) return 2; // "dent" -> "dental"
  if (keyword.length >= 4 && word.startsWith(keyword)) return 2; // "doctors" -> "doctor"
  return 0;
};

/** Best-matching emojis for free text, most relevant first. Ties keep the dataset's (popularity) order. */
export function suggestEmojis(index: IndexedEmoji[], text: string, limit = 6): string[] {
  const words = queryWords(text);
  if (!words.length) return [];

  const scored: { emoji: string; score: number; order: number }[] = [];
  index.forEach(({ emoji, keywords }, order) => {
    let score = 0;
    for (const word of words) {
      let best = 0;
      for (const keyword of keywords) best = Math.max(best, scoreKeyword(word, keyword));
      score += best;
    }
    // Matching the emoji's primary name is a stronger signal than a loose tag.
    if (score > 0 && words.some((w) => keywords[0] === w)) score += 1;
    if (score > 0) scored.push({ emoji, score, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.emoji);
}
