// Integration test for the per-conversation "last message" times the sidebar sorts by. Real database; run against a
// migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { channelRoutes } from './channels.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let me: string, other: string, outsider: string, guest: string, workspaceId: string;
let general: string, quiet: string, secret: string, dm: string, lobby: string;

const at = (iso: string) => new Date(iso);
const activity = async (as = me) =>
  (await app.inject({ method: 'GET', url: `/api/channels/workspaces/${workspaceId}/activity`, headers: { 'x-test-user': as } })).json();

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(channelRoutes, { prefix: '/api/channels' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@activity.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  [me, other, outsider, guest] = (await Promise.all([mk('me'), mk('other'), mk('outsider'), mk('guest')])).map((u) => u.id);
  workspaceId = (await prisma.workspace.create({ data: { name: 'Activity', slug: `act-${run}`, ownerId: other } })).id;
  await prisma.workspaceMember.createMany({ data: [me, other].map((userId) => ({ workspaceId, userId, role: 'MEMBER' as const })) });
  await prisma.workspaceMember.create({ data: { workspaceId, userId: guest, role: 'GUEST' } });
  const ch = (name: string, type: 'PUBLIC' | 'PRIVATE' | 'DIRECT') =>
    prisma.channel.create({ data: { workspaceId, name, type, createdById: other } }).then((c) => c.id);
  [general, quiet, secret, dm, lobby] = await Promise.all([ch('general', 'PUBLIC'), ch('quiet', 'PUBLIC'), ch('secret', 'PRIVATE'), ch('dm', 'DIRECT'), ch('lobby', 'PUBLIC')]);
  await prisma.channelMember.createMany({
    data: [{ channelId: secret, userId: other }, { channelId: dm, userId: me }, { channelId: dm, userId: other }, { channelId: lobby, userId: guest }],
  });

  const msg = (channelId: string, createdAt: string, extra = {}) =>
    prisma.message.create({ data: { channelId, userId: other, content: 'hi', createdAt: at(createdAt), ...extra } });
  const parent = await msg(general, '2026-01-01T10:00:00Z');
  await msg(general, '2026-01-01T12:00:00Z', { parentMessageId: parent.id }); // a thread reply: not channel activity
  await msg(general, '2026-01-01T13:00:00Z', { isDeleted: true }); // deleted: not activity
  await msg(dm, '2026-01-02T09:00:00Z');
  await msg(dm, '2026-01-01T08:00:00Z');
  await msg(secret, '2026-01-03T00:00:00Z');
  await msg(lobby, '2026-01-04T00:00:00Z', { userId: guest });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@activity.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('conversation activity', () => {
  it("gives each visible conversation's latest top-level message time", async () => {
    const body = await activity();
    assert.equal(body[general], at('2026-01-01T10:00:00Z').getTime(), 'thread replies and deleted messages do not count');
    assert.equal(body[dm], at('2026-01-02T09:00:00Z').getTime(), 'the newest message wins');
  });

  it('leaves out conversations with no messages and private ones the user is not in', async () => {
    const body = await activity();
    assert.equal(quiet in body, false);
    assert.equal(secret in body, false, 'a private channel must not leak its activity to non-members');
  });

  it('tells someone outside the workspace nothing, not even about public channels', async () => {
    assert.deepEqual(await activity(outsider), {});
  });

  it('shows a guest only the channels they were added to, public or not', async () => {
    assert.deepEqual(Object.keys(await activity(guest)), [lobby]);
    const read = (channelId: string) =>
      app.inject({ method: 'GET', url: `/api/channels/${channelId}/messages`, headers: { 'x-test-user': guest } });
    assert.equal((await read(general)).statusCode, 403, 'public channel the guest is not in');
    assert.equal((await read(lobby)).statusCode, 200, 'public channel the guest was added to');
  });
});
