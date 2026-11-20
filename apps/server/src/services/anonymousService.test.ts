import test from 'node:test';
import assert from 'node:assert/strict';
import { anonId, sanitizeMessageForViewer, emitPerViewer } from './anonymousService.js';

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
