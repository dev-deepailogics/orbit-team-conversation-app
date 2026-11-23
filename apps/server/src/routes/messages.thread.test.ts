// Integration test for who is alerted about thread replies. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { messageRoutes } from './messages.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let users: Record<'a' | 'b' | 'c' | 'd', string>;
let workspaceId: string, channelId: string, parentId: string;
const emitted: { room: string; event: string; payload: any }[] = [];

const reply = (who: keyof typeof users, content: string, messageId = parentId) =>
  app.inject({ method: 'POST', url: `/api/messages/${messageId}/replies`, payload: { content }, headers: { 'x-test-user': users[who] } });
const alertedRooms = () => emitted.filter((e) => e.event === 'thread:reply_notify').map((e) => e.room).sort();
const room = (who: keyof typeof users) => `user:${users[who]}`;

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: (r: string) => ({ emit: (event: string, payload: any) => emitted.push({ room: r, event, payload }) }) } as any);
  await app.register(messageRoutes, { prefix: '/api/messages' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@threadtest.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  const [a, b, c, d] = await Promise.all(['alice', 'bob', 'carol', 'dave'].map(mk));
  users = { a: a.id, b: b.id, c: c.id, d: d.id };
  const ws = await prisma.workspace.create({ data: { name: 'Thread test', slug: `thread-${run}`, ownerId: a.id } });
  workspaceId = ws.id;
  await prisma.workspaceMember.createMany({ data: [a, b, c, d].map((u) => ({ workspaceId, userId: u.id, role: 'MEMBER' as const })) });
  const ch = await prisma.channel.create({ data: { workspaceId, name: 'general', type: 'PUBLIC', createdById: a.id } });
  channelId = ch.id;
  await prisma.channelMember.createMany({ data: [a, b, c, d].map((u) => ({ channelId, userId: u.id })) });
  parentId = (await prisma.message.create({ data: { channelId, userId: a.id, content: 'Anyone seen the deploy?' } })).id;
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@threadtest.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('thread reply alerts', () => {
  it('alerts the author of the thread starter, not everyone in the channel', async () => {
    emitted.length = 0;
    assert.equal((await reply('b', 'yes, looks fine')).statusCode, 201);
    assert.deepEqual(alertedRooms(), [room('a')]);
  });

  it('still tells the whole channel a reply happened, so counts and open threads stay current', async () => {
    const live = emitted.filter((e) => e.event === 'message:new' && e.payload.isThreadReply);
    assert.deepEqual(live.map((e) => e.room), [`channel:${channelId}`]);
  });

  it('alerts everyone who has replied, but not the person who just replied, nor bystanders', async () => {
    emitted.length = 0;
    await reply('c', 'same here'); // carol joins the thread
    assert.deepEqual(alertedRooms(), [room('a'), room('b')].sort());
    emitted.length = 0;
    await reply('b', 'thanks carol'); // bob again: alice and carol are in the thread, bob is not alerted about himself
    assert.deepEqual(alertedRooms(), [room('a'), room('c')].sort());
    assert.ok(!alertedRooms().includes(room('d')), 'dave never took part in the thread');
  });

  it('does not alert someone who has since left the channel', async () => {
    await prisma.channelMember.deleteMany({ where: { channelId, userId: users.c } });
    emitted.length = 0;
    await reply('b', 'carol left');
    assert.deepEqual(alertedRooms(), [room('a')]);
  });

  const setPreference = (who: keyof typeof users, notificationPreference: 'ALL' | 'MENTIONS' | 'MUTED') =>
    prisma.channelMember.update({ where: { channelId_userId: { channelId, userId: users[who] } }, data: { notificationPreference } });

  it('alerts a participant who muted the channel only when the reply @mentions them', async () => {
    await setPreference('a', 'MUTED');
    emitted.length = 0;
    await reply('b', 'still there?');
    assert.deepEqual(alertedRooms(), []);
    emitted.length = 0;
    await reply('b', 'still there? @alice');
    assert.deepEqual(alertedRooms(), [room('a')], 'a mention always notifies');
  });

  it('alerts a channel member mentioned in the thread even if they never took part, nor muted them', async () => {
    await setPreference('d', 'MUTED');
    emitted.length = 0;
    await reply('b', 'what do you think @dave');
    assert.deepEqual(alertedRooms(), [room('d')]);
    await setPreference('d', 'ALL');
  });

  it('alerts a mentions-only participant only when the reply @mentions them', async () => {
    await setPreference('a', 'MENTIONS');
    emitted.length = 0;
    await reply('b', 'no mention here');
    assert.deepEqual(alertedRooms(), []);
    emitted.length = 0;
    await reply('b', 'ping @alice');
    assert.deepEqual(alertedRooms(), [room('a')]);
    await setPreference('a', 'ALL');
  });
});
