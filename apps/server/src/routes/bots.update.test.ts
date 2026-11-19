// Integration test for creating and editing bot apps (default image + name/description/image edits).
// Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { botRoutes } from './bots.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let admin: string, member: string, workspaceId: string, otherWorkspaceId: string;

const as = (userId: string) => ({ 'x-test-user': userId });
const createBot = (payload: object, userId = admin, ws = () => workspaceId) =>
  app.inject({ method: 'POST', url: `/api/bot/workspaces/${ws()}/bots`, payload, headers: as(userId) });
const editBot = (botId: string, payload: object, userId = admin, ws = workspaceId) =>
  app.inject({ method: 'PATCH', url: `/api/bot/workspaces/${ws}/bots/${botId}`, payload, headers: as(userId) });

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }), emit: () => {} } as any);
  await app.register(botRoutes, { prefix: '/api/bot' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@bots.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  const [a, m] = await Promise.all([mk('admin'), mk('member')]);
  admin = a.id;
  member = m.id;
  const ws = (slug: string) => prisma.workspace.create({ data: { name: 'Bots', slug: `${slug}-${run}`, ownerId: admin } });
  workspaceId = (await ws('bots')).id;
  otherWorkspaceId = (await ws('bots-other')).id;
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId, userId: admin, role: 'ADMIN' as const },
      { workspaceId, userId: member, role: 'MEMBER' as const },
      { workspaceId: otherWorkspaceId, userId: admin, role: 'ADMIN' as const },
    ],
  });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@bots.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('bot apps', () => {
  it('creates a bot with no image, so clients show the Orbit logo', async () => {
    const res = await createBot({ name: 'DeployBot' });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().avatarUrl, null);
  });

  it('rejects third-party image URLs on create', async () => {
    const res = await createBot({ name: 'Tracker', avatarUrl: 'https://evil.example/pixel.png' });
    assert.equal(res.statusCode, 400);
  });

  it('lets an admin change the name, description and image, then reset the image', async () => {
    const bot = (await createBot({ name: 'CI Bot' })).json();
    const upload = '/api/files/download/some-key';

    const edited = await editBot(bot.id, { name: 'CI Notifier', description: 'Posts build results', avatarUrl: upload });
    assert.equal(edited.statusCode, 200);
    assert.equal(edited.json().name, 'CI Notifier');
    assert.equal(edited.json().description, 'Posts build results');
    assert.equal(edited.json().avatarUrl, upload);
    assert.equal(edited.json().botToken, bot.botToken, 'editing never changes the token');

    const reset = await editBot(bot.id, { avatarUrl: null });
    assert.equal(reset.statusCode, 200);
    assert.equal(reset.json().avatarUrl, null);
    assert.equal(reset.json().name, 'CI Notifier', 'untouched fields are kept');
  });

  it('refuses edits from non-admin members', async () => {
    const bot = (await createBot({ name: 'Guarded' })).json();
    const res = await editBot(bot.id, { name: 'Hijacked' }, member);
    assert.equal(res.statusCode, 403);
  });

  it("refuses editing another workspace's bot through this workspace", async () => {
    const bot = (await createBot({ name: 'Elsewhere' }, admin, () => otherWorkspaceId)).json();
    const res = await editBot(bot.id, { name: 'Moved' }, admin, workspaceId);
    assert.equal(res.statusCode, 404);
  });

  it('validates the new values', async () => {
    const bot = (await createBot({ name: 'Valid' })).json();
    assert.equal((await editBot(bot.id, {})).statusCode, 400, 'empty update');
    assert.equal((await editBot(bot.id, { name: 'x' })).statusCode, 400, 'name too short');
    assert.equal((await editBot(bot.id, { avatarUrl: 'https://evil.example/a.png' })).statusCode, 400, 'foreign image');
  });
});
