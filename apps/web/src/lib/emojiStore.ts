const DEFAULT_TOP_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀'];

const STORAGE_KEY = 'orbit_emoji_usage_v1';

export function getTopEmojis(count: number = 5): string[] {
  if (typeof window === 'undefined') return DEFAULT_TOP_EMOJIS.slice(0, count);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOP_EMOJIS.slice(0, count);
    const usage: Record<string, number> = JSON.parse(raw);
    const sorted = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([em]) => em);

    // Merge with defaults to ensure we always have at least `count` emojis
    const combined = Array.from(new Set([...sorted, ...DEFAULT_TOP_EMOJIS]));
    return combined.slice(0, count);
  } catch (e) {
    return DEFAULT_TOP_EMOJIS.slice(0, count);
  }
}

export function recordEmojiUsage(emoji: string): void {
  if (typeof window === 'undefined' || !emoji) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const usage: Record<string, number> = raw ? JSON.parse(raw) : {};
    usage[emoji] = (usage[emoji] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch (e) {
    console.error('Failed to save emoji usage', e);
  }
}

export const POPULAR_REACTION_EMOJIS = [
  '👍', '👎', '❤️', '🔥', '🎉', '🚀', '😂', '😮',
  '😢', '👏', '🙌', '👀', '💯', '✨', '💡', '⚡',
  '🥳', '🤔', '🤝', '🎯', '🙏', '😍', '💪', '🤩',
  '😎', '🤯', '😴', '😭', '💀', '🎈', '🏆', '⭐'
];
