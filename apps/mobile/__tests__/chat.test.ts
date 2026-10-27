import type { Channel, Message } from '@orbit/types';
import { useChatStore } from '../src/features/chat/store';
import { groupReactions, showHeader, typingLabel } from '../src/features/chat/utils';
import { channelLabel, parseInviteCode, splitChannels } from '../src/features/workspaces/utils';

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
