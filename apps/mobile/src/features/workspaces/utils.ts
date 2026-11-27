import type { Channel, WorkspaceMember } from '@orbit/types';

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

// The other person in a 1:1 DM (yourself in a self-DM); undefined for channels and group DMs.
function dmPeer(channel: Channel, myId: string | undefined) {
  if (channel.type !== 'DIRECT') return undefined;
  const members = channel.members ?? [];
  return members.find(m => m.userId !== myId) ?? members[0];
}

// 1:1 DMs (and self-DMs) show the other person's photo; group DMs keep initials.
export const dmAvatarUrl = (channel: Channel, myId: string | undefined) => dmPeer(channel, myId)?.user?.avatarUrl ?? null;
export const dmPeerId = (channel: Channel, myId: string | undefined) => dmPeer(channel, myId)?.userId;

export function channelPrefix(channel: Channel): string {
  if (channel.isAnonymous) return '🎭';
  return channel.type === 'PRIVATE' ? '🔒' : '#';
}

// Like web/Slack, every workspace member gets a DM row. Members without a 1:1 channel yet get a
// placeholder (fake id, never sent to the server); the real channel is created on first tap.
const PENDING_DM = 'pending-dm:';
export const pendingDMUserId = (c: Channel) => (c.id.startsWith(PENDING_DM) ? c.members?.[0]?.userId : undefined);

function pendingDMs(dms: Channel[], members: WorkspaceMember[], myId: string | undefined): Channel[] {
  const peers = new Set(
    dms
      .filter(c => c.type === 'DIRECT' && c.members?.length)
      .map(c => c.members!.find(m => m.userId !== myId)?.userId ?? myId), // self-DM → me
  );
  return members
    .filter(m => !peers.has(m.userId))
    .map(m => ({ id: PENDING_DM + m.userId, workspaceId: m.workspaceId, name: '', type: 'DIRECT', members: [m] }) as Channel);
}

export function splitChannels(channels: Channel[], myId: string | undefined, members: WorkspaceMember[] = []) {
  const byLabel = (a: Channel, b: Channel) => channelLabel(a, myId).localeCompare(channelLabel(b, myId));
  const dms = channels.filter(isDirect);
  return {
    channels: channels.filter(c => !isDirect(c) && !c.isArchived).sort(byLabel),
    dms: [...dms, ...pendingDMs(dms, members, myId)].sort(byLabel),
  };
}

// Accepts a bare code or a web invite link (https://<host>/join/<code>, see apps/web/src/app/join).
export function parseInviteCode(input: string): string {
  const text = input.trim();
  const match = text.match(/\/join\/([^/?#\s]+)/);
  return match ? match[1] : text;
}
