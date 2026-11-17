import type { Channel, Message } from '@orbit/types';
import { useChatStore } from '../src/features/chat/store';
import {
  formatBytes,
  groupReactions,
  isImage,
  messageChangeLabel,
  messagePermissions,
  senderAvatarUrl,
  showHeader,
  typingLabel,
} from '../src/features/chat/utils';
import { channelLabel, dmAvatarUrl, parseInviteCode, pendingDMUserId, splitChannels } from '../src/features/workspaces/utils';

const msg = (over: Partial<Message>) =>
  ({ id: 'm1', channelId: 'c1', userId: 'u1', parentMessageId: null, createdAt: '2026-10-26T10:00:00Z', ...over }) as Message;
const member = (userId: string, displayName: string) => ({ userId, user: { displayName } }) as any;
const chan = (over: Partial<Channel>) => ({ id: 'c', name: 'general', type: 'PUBLIC', members: [], ...over }) as Channel;

test('DM labels name the other people, or "(you)" for a self-DM', () => {
  expect(channelLabel(chan({ type: 'DIRECT', name: 'dm-1', members: [member('me', 'Me'), member('u2', 'Bo')] }), 'me')).toBe('Bo');
  expect(channelLabel(chan({ type: 'DIRECT', name: 'dm-1', members: [member('me', 'Me')] }), 'me')).toBe('Me (you)');
  expect(channelLabel(chan({ name: 'random' }), 'me')).toBe('random');
  const { channels, dms } = splitChannels([chan({ id: '1', name: 'zeta' }), chan({ id: '2', type: 'DIRECT' }), chan({ id: '3', name: 'alpha' })], 'me');
  expect(channels.map(c => c.id)).toEqual(['3', '1']);
  expect(dms.map(c => c.id)).toEqual(['2']);
});

test('every workspace member gets a DM row; existing DMs are not duplicated', () => {
  const members = [member('me', 'Me'), member('u2', 'Bo'), member('u3', 'Al')];
  const existing = chan({ id: 'd1', type: 'DIRECT', members: [members[0], members[1]] });
  const { dms } = splitChannels([existing], 'me', members);
  expect(dms.map(c => [c.id, pendingDMUserId(c)])).toEqual([
    ['pending-dm:u3', 'u3'],
    ['d1', undefined],
    ['pending-dm:me', 'me'],
  ]);
});

test('avatars: photo for real senders and 1:1 DM peers, never for anonymous posts', () => {
  const user = { avatarUrl: '/api/files/download/a.png' } as any;
  expect(senderAvatarUrl(msg({ user }))).toBe('/api/files/download/a.png');
  expect(senderAvatarUrl(msg({ user, isAnonymous: true }))).toBeNull();
  expect(senderAvatarUrl(msg({ user, isAnonymous: true, bot: { avatarUrl: '/b.png' } as any }))).toBe('/b.png');
  const peer = { userId: 'u2', user } as any;
  expect(dmAvatarUrl(chan({ type: 'DIRECT', members: [member('me', 'Me'), peer] }), 'me')).toBe('/api/files/download/a.png');
  expect(dmAvatarUrl(chan({ type: 'GROUP_DIRECT', members: [peer] }), 'me')).toBeNull();
});

test('parseInviteCode accepts links and bare codes', () => {
  expect(parseInviteCode(' https://orbit.example.com/join/abc-123?x=1 ')).toBe('abc-123');
  expect(parseInviteCode('abc-123')).toBe('abc-123');
});

test('showHeader groups same sender within 5 minutes', () => {
  const a = msg({});
  expect(showHeader(undefined, a)).toBe(true);
  expect(showHeader(a, msg({ id: 'm2', createdAt: '2026-10-26T10:04:00Z' }))).toBe(false);
  expect(showHeader(a, msg({ id: 'm2', createdAt: '2026-10-26T10:06:00Z' }))).toBe(true);
  expect(showHeader(a, msg({ id: 'm2', userId: 'u2', createdAt: '2026-10-26T10:01:00Z' }))).toBe(true);
});

test('groupReactions counts per emoji and flags mine', () => {
  const reactions = [
    { id: '1', messageId: 'm', userId: 'u1', emoji: '👍' },
    { id: '2', messageId: 'm', userId: 'me', emoji: '👍' },
    { id: '3', messageId: 'm', userId: 'u2', emoji: '🎉' },
  ];
  expect(groupReactions(reactions, 'me')).toEqual([
    { emoji: '👍', count: 2, mine: true },
    { emoji: '🎉', count: 1, mine: false },
  ]);
});

test('typingLabel', () => {
  expect(typingLabel(['A', 'B'])).toBe('A and B are typing…');
  expect(typingLabel([])).toBe('');
});

describe('chat store', () => {
  beforeEach(() => useChatStore.setState({ ...useChatStore.getState(), channelId: 'c1', messages: [msg({})] }));

  test('dedupes HTTP + socket copies and prefers the self copy', () => {
    const { receiveMessage } = useChatStore.getState();
    receiveMessage(msg({ id: 'm2', isSelf: false }));
    receiveMessage(msg({ id: 'm2', isSelf: true }));
    receiveMessage(msg({ id: 'm2', isSelf: false }));
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[1].isSelf).toBe(true);
  });

  test('ignores root messages for other channels', () => {
    useChatStore.getState().receiveMessage(msg({ id: 'x', channelId: 'other' }));
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  test('a reply bumps the parent count once, even if delivered twice to an open thread', () => {
    useChatStore.setState({ thread: { parentId: 'm1', parent: msg({}), replies: [], isLoading: false, error: '' } });
    const reply = msg({ id: 'r1', parentMessageId: 'm1' });
    useChatStore.getState().receiveMessage(reply);
    useChatStore.getState().receiveMessage(reply);
    const s = useChatStore.getState();
    expect(s.thread.replies).toHaveLength(1);
    expect(s.messages[0].replyCount).toBe(1);
    expect(s.thread.parent?.replyCount).toBe(1);
  });
});

test('attachments: SVGs are files, not slideshow images; sizes read like Slack', () => {
  expect(isImage('image/jpeg')).toBe(true);
  expect(isImage('image/svg+xml')).toBe(false);
  expect(isImage('application/pdf')).toBe(false);
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(2048)).toBe('2 KB');
  expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
});

test('only authors edit; authors and workspace admins delete; nothing once deleted', () => {
  const mine = msg({ userId: 'me' });
  expect(messagePermissions(mine, 'me', false)).toEqual({ canEdit: true, canDelete: true });
  expect(messagePermissions(msg({ userId: 'u2' }), 'me', false)).toEqual({ canEdit: false, canDelete: false });
  expect(messagePermissions(msg({ userId: 'u2' }), 'me', true)).toEqual({ canEdit: false, canDelete: true });
  expect(messagePermissions(msg({ userId: 'me', isDeleted: true }), 'me', true)).toEqual({ canEdit: false, canDelete: false });
});

describe('messageChangeLabel', () => {
  const sent = '2026-11-17T10:42:00';
  const make = (over: Partial<Message>) => ({ createdAt: sent, updatedAt: sent, isEdited: false, isDeleted: false, ...over }) as Message;

  test('nothing for a message that was never edited or deleted', () => {
    expect(messageChangeLabel(make({ updatedAt: '2026-11-17T10:45:00' }))).toBeNull(); // e.g. only pinned
  });

  test('hidden when updatedAt equals createdAt, or is missing or invalid', () => {
    expect(messageChangeLabel(make({ isEdited: true }))).toBeNull();
    expect(messageChangeLabel(make({ isEdited: true, updatedAt: undefined as never }))).toBeNull();
    expect(messageChangeLabel(make({ isEdited: true, updatedAt: 'nope' }))).toBeNull();
  });

  test('says edited or deleted with the time it happened', () => {
    expect(messageChangeLabel(make({ isEdited: true, updatedAt: '2026-11-17T10:45:00' }))).toMatch(/^edited 10:45/);
    expect(messageChangeLabel(make({ isDeleted: true, updatedAt: '2026-11-17T11:00:00' }))).toMatch(/^deleted 11:00/);
    // edited and then deleted reads as deleted
    expect(messageChangeLabel(make({ isEdited: true, isDeleted: true, updatedAt: '2026-11-17T11:00:00' }))).toMatch(/^deleted/);
  });

  test('adds the date when it happened on a different day than it was sent', () => {
    expect(messageChangeLabel(make({ isEdited: true, updatedAt: '2026-11-18T09:05:00' }))).toMatch(/^edited .+, 9:05/);
  });
});
