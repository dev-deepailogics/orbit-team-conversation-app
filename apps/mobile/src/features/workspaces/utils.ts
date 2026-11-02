import type { Channel } from '@orbit/types';

export const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

// DMs are named "dm-xxxx" server-side; show the other people instead, like Slack.
export function channelLabel(channel: Channel, myId: string | undefined): string {
  if (!isDirect(channel)) return channel.name;
  const members = channel.members ?? [];
  const others = members.filter(m => m.userId !== myId).map(m => m.user?.displayName || m.user?.username || 'Unknown');
  if (others.length) return others.join(', ');
  const me = members.find(m => m.userId === myId)?.user;
  return `${me?.displayName ?? 'You'} (you)`;
}

export function channelPrefix(channel: Channel): string {
  if (channel.isAnonymous) return '🎭';
  return channel.type === 'PRIVATE' ? '🔒' : '#';
}

export function splitChannels(channels: Channel[], myId: string | undefined) {
  const byLabel = (a: Channel, b: Channel) => channelLabel(a, myId).localeCompare(channelLabel(b, myId));
  return {
    channels: channels.filter(c => !isDirect(c) && !c.isArchived).sort(byLabel),
    dms: channels.filter(isDirect).sort(byLabel),
  };
}

// Accepts a bare code or a web invite link (https://<host>/join/<code>, see apps/web/src/app/join).
export function parseInviteCode(input: string): string {
  const text = input.trim();
  const match = text.match(/\/join\/([^/?#\s]+)/);
  return match ? match[1] : text;
}
