import type { Attachment, Message, Reaction } from '@orbit/types';
import { SERVER_URL } from '@/lib/config';

// Socket payloads for normal channels don't carry isSelf, so fall back to comparing ids.
export const isMine = (m: Message, myId: string | undefined) => !!m.isSelf || (!!myId && m.userId === myId);

// Mirrors apps/server/src/routes/messages.ts: only authors edit; authors and workspace admins delete.
export function messagePermissions(m: Message, myId: string | undefined, isAdmin: boolean) {
  const mine = !m.bot && !m.isDeleted && isMine(m, myId);
  return { canEdit: mine, canDelete: !m.isDeleted && (mine || isAdmin) };
}

export function senderName(m: Message): string {
  if (m.isAnonymous && !m.bot) return m.anonName || m.user?.displayName || 'Anonymous Member';
  return m.bot?.name || m.user?.displayName || m.user?.username || 'Unknown';
}

export function senderEmoji(m: Message): string | null {
  if (m.bot) return '🤖';
  return m.isAnonymous ? m.anonEmoji || '🎭' : null;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

export function isNewDay(prev: Message | undefined, m: Message): boolean {
  return !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
}

// Slack groups consecutive messages from the same sender within a few minutes under one name/avatar.
export function showHeader(prev: Message | undefined, m: Message): boolean {
  if (!prev || isNewDay(prev, m)) return true;
  const sender = (x: Message) => x.bot?.id ?? (x.isAnonymous ? x.anonName : x.userId);
  return sender(prev) !== sender(m) || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > GROUP_GAP_MS;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
}

export function groupReactions(reactions: Reaction[] | undefined, myId: string | undefined): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const r of reactions ?? []) {
    const g = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    g.mine ||= r.userId === myId;
    groups.set(r.emoji, g);
  }
  return [...groups.values()];
}

export function typingLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

// SVGs can't be drawn by <Image>, so they're treated as plain files.
export const isImage = (type: string) => type.startsWith('image/') && !type.includes('svg');

// Downloads are public GETs (see apps/server/src/routes/files.ts).
export const fileUrl = (a: Pick<Attachment, 'fileUrl'>) => SERVER_URL + a.fileUrl;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
