// Slack-style break statuses. The emoji travels inside the stored reason ("🍽️ Lunch · back at 2"),
// so no schema change is needed and every place that prints the reason shows the emoji too.

export const OTHER_REASON = 'Other';
export const DEFAULT_CUSTOM_EMOJI = '💬';
const FALLBACK_EMOJI = '⏸️';

export const BREAK_PRESETS = [
  { label: 'Lunch', emoji: '🍽️' },
  { label: 'Namaz', emoji: '🕌' },
  { label: 'Tea Break', emoji: '☕' },
  { label: 'Personal', emoji: '🏠' },
  { label: 'Meeting / Discussion', emoji: '🗓️' },
  { label: OTHER_REASON, emoji: DEFAULT_CUSTOM_EMOJI },
] as const;

const PRESET_EMOJI = new Map<string, string>(BREAK_PRESETS.map((p) => [p.label.toLowerCase(), p.emoji]));

// A leading emoji: pictograph (or flag halves) plus any variation selectors, skin tones and ZWJ joins.
// Built via RegExp because the web tsconfig targets ES5, which rejects the `u` flag on literals.
const LEADING_EMOJI = new RegExp(
  '^((?:\\p{Extended_Pictographic}|\\p{Regional_Indicator})(?:\\uFE0F|\\u20E3|\\p{Emoji_Modifier}|\\p{Regional_Indicator}|\\u200D\\p{Extended_Pictographic})*)\\s*',
  'u',
);

export const formatBreakReason = (emoji: string, text: string) => `${emoji} ${text.trim()}`;

/** Split a stored reason into its emoji and text. Reasons saved before emojis existed get their preset's emoji. */
export function parseBreakReason(reason?: string | null): { emoji: string; text: string } {
  const raw = reason?.trim() || 'On break';
  const match = raw.match(LEADING_EMOJI);
  if (match) return { emoji: match[1], text: raw.slice(match[0].length) || 'On break' };

  const base = raw.split(' · ')[0].trim().toLowerCase();
  return { emoji: PRESET_EMOJI.get(base) ?? FALLBACK_EMOJI, text: raw };
}

/** Ensure a reason is stored with its emoji prefix (no-op if it already has one). */
export function withBreakEmoji(reason: string): string {
  const { emoji, text } = parseBreakReason(reason);
  return formatBreakReason(emoji, text);
}
