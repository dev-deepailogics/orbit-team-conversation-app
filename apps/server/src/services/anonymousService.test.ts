import test from 'node:test';
import assert from 'node:assert/strict';
import { anonId, sanitizeMessageForViewer, sanitizeChannelForViewer, emitPerViewer } from './anonymousService.js';

const msg = {
  id: 'm1234567-aaaa',
  userId: '11111111-2222-3333-4444-555555555555',
  user: { id: '11111111-2222-3333-4444-555555555555', username: 'real', displayName: 'Real Person', avatarUrl: '/a.png' },
  anonName: 'Machli',
  anonEmoji: '🐬',
  attachments: [{ id: 'a1', fileName: 'x.png', uploaderId: '11111111-2222-3333-4444-555555555555', uploader: { id: 'u' } }],
  reactions: [{ userId: '11111111-2222-3333-4444-555555555555', emoji: '👍', user: { id: '11111111-2222-3333-4444-555555555555', displayName: 'Real Person' } }],
};

test('anonId does not contain the real id and differs per channel', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  const a = anonId('c1', uid);
  assert.ok(a.startsWith('anon-'));
  assert.ok(!a.includes(uid.slice(0, 8)));
  assert.equal(a, anonId('c1', uid));
  assert.notEqual(a, anonId('c2', uid));
});

test('anonymous message hides author, uploader and reactor from other viewers', () => {
  const out = sanitizeMessageForViewer(msg, 'someone-else', true);
  const json = JSON.stringify(out);
  assert.ok(!json.includes('Real Person'));
  assert.ok(!json.includes('11111111-2222'));
  assert.ok(!json.includes('uploaderId'));
  assert.equal(out.isSelf, false);
});

test('the author still sees their own message and reaction as theirs', () => {
  const out = sanitizeMessageForViewer(msg, msg.userId, true);
  assert.equal(out.isSelf, true);
  assert.equal(out.reactions[0].userId, msg.userId);
});

test('emitPerViewer builds one payload per socket user', async () => {
  const sent: Array<[string, any]> = [];
  const io: any = {
    in: () => ({ fetchSockets: async () => [{ id: 's1', data: { userId: 'u1' } }, { id: 's2', data: { userId: 'u2' } }] }),
    to: (id: string) => ({ emit: (_e: string, p: any) => sent.push([id, p]) }),
  };
  await emitPerViewer(io, 'room', 'ev', (v) => ({ v }));
  assert.deepEqual(sent, [['s1', { v: 'u1' }], ['s2', { v: 'u2' }]]);
});

const channel = {
  id: 'c1',
  isAnonymous: true,
  members: [
    { id: 'm2', channelId: 'c1', userId: 'u2', anonName: 'Owl', anonEmoji: '🦉', lastReadAt: 'x', user: { id: 'u2', displayName: 'Zed' } },
    { id: 'm1', channelId: 'c1', userId: 'u1', anonName: 'Fox', anonEmoji: '🦊', lastReadAt: 'y', notificationPreference: 'ALL', user: { id: 'u1', displayName: 'Amy' } },
  ],
};

test('anonymous channel roster shows real names with no persona anywhere', () => {
  const out = sanitizeChannelForViewer(channel, 'u1');
  const json = JSON.stringify(out);
  assert.ok(!json.includes('Owl') && !json.includes('Fox') && !json.includes('anonName') && !json.includes('anonEmoji'));
  assert.deepEqual(out.members.map((m: any) => m.user.displayName), ['Amy', 'Zed'], 'sorted by real name');
  assert.equal(out.members[0].notificationPreference, 'ALL', 'own membership keeps its own fields');
  assert.equal(out.members[1].lastReadAt, undefined, 'others do not expose read state');
});

test('regular channels are left untouched', () => {
  const c = { id: 'c', isAnonymous: false, members: [{ id: 'm', userId: 'u', anonName: null }] };
  assert.equal(sanitizeChannelForViewer(c, 'u'), c);
});
