// Integration test for who may edit or delete a message. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { messageRoutes } from './messages.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let u: Record<'author' | 'admin' | 'superadmin' | 'member', string>;
let workspaceId: string, channelId: string;
const emitted: { event: string; payload: any }[] = [];

const mkMessage = async (content = 'original text') =>
  (await prisma.message.create({ data: { channelId, userId: u.author, content } })).id;
const edit = (as: keyof typeof u, id: string, content = 'rewritten') =>
  app.inject({ method: 'PATCH', url: `/api/messages/${id}`, payload: { content }, headers: { 'x-test-user': u[as] } });
const del = (as: keyof typeof u, id: string) =>
  app.inject({ method: 'DELETE', url: `/api/messages/${id}`, headers: { 'x-test-user': u[as] } });
const row = (id: string) => prisma.message.findUniqueOrThrow({ where: { id } });

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: (event: string, payload: any) => emitted.push({ event, payload }) }) } as any);
  await app.register(messageRoutes, { prefix: '/api/messages' });

  const mk = (n: string, systemRole: 'USER' | 'SUPER_ADMIN' = 'USER') =>
    prisma.user.create({ data: { email: `${n}-${run}@moderation.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x', systemRole } });
  const [author, admin, superadmin, member] = await Promise.all([mk('author'), mk('admin'), mk('superadmin', 'SUPER_ADMIN'), mk('member')]);
  u = { author: author.id, admin: admin.id, superadmin: superadmin.id, member: member.id };
  const ws = await prisma.workspace.create({ data: { name: 'Moderation', slug: `mod-${run}`, ownerId: admin.id } });
  workspaceId = ws.id;
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId, userId: author.id, role: 'MEMBER' as const },
      { workspaceId, userId: admin.id, role: 'ADMIN' as const },
      { workspaceId, userId: superadmin.id, role: 'MEMBER' as const },
      { workspaceId, userId: member.id, role: 'MEMBER' as const },
    ],
  });
  const ch = await prisma.channel.create({ data: { workspaceId, name: 'general', type: 'PUBLIC', createdById: admin.id } });
  channelId = ch.id;
  await prisma.channelMember.createMany({ data: [author, admin, superadmin, member].map((x) => ({ channelId, userId: x.id })) });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@moderation.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('editing a message', () => {
  it('lets the author edit', async () => {
    const id = await mkMessage();
    const res = await edit('author', id);
    assert.equal(res.statusCode, 200);
    assert.equal((await row(id)).content, 'rewritten');
    assert.equal((await row(id)).isEdited, true);
  });

  it('does not let a super admin edit someone else’s message', async () => {
    const id = await mkMessage();
    const res = await edit('superadmin', id);
    assert.equal(res.statusCode, 403);
    assert.equal((await row(id)).content, 'original text');
  });

  it('does not let a workspace admin or another member edit it either', async () => {
    const id = await mkMessage();
    assert.equal((await edit('admin', id)).statusCode, 403);
    assert.equal((await edit('member', id)).statusCode, 403);
    assert.equal((await row(id)).content, 'original text');
  });
});

describe('deleting a message', () => {
  it('lets a workspace admin delete it, and records who did', async () => {
    const id = await mkMessage();
    const res = await del('admin', id);
    assert.equal(res.statusCode, 200);
    const m = await row(id);
    assert.equal(m.isDeleted, true);
    assert.equal(m.content, '');
    assert.equal(m.deletedById, u.admin);
    assert.equal(m.deletedByName, 'admin');
    const live = emitted.filter((e) => e.event === 'message:deleted').at(-1)!;
    assert.equal(live.payload.message.deletedByName, 'admin', 'everyone watching the channel is told who deleted it');
  });

  it('lets a super admin delete it, and records who did', async () => {
    const id = await mkMessage();
    assert.equal((await del('superadmin', id)).statusCode, 200);
    assert.equal((await row(id)).deletedByName, 'superadmin');
  });

  it('does not flag the author deleting their own message', async () => {
    const id = await mkMessage();
    assert.equal((await del('author', id)).statusCode, 200);
    const m = await row(id);
    assert.equal(m.isDeleted, true);
    assert.equal(m.deletedById, null);
    assert.equal(m.deletedByName, null);
  });

  it('still refuses an ordinary member deleting someone else’s message', async () => {
    const id = await mkMessage();
    assert.equal((await del('member', id)).statusCode, 403);
    assert.equal((await row(id)).isDeleted, false);
  });
});
