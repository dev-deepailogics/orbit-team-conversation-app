// Integration test for call announcements. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { huddleRoutes } from './huddles.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let a: { id: string }, b: { id: string }, channelId: string, workspaceId: string;
const emitted: { room: string; event: string; payload: any }[] = [];

const start = (userId: string) =>
  app.inject({ method: 'POST', url: `/api/huddles/${channelId}/start`, headers: { 'x-test-user': userId } });
const started = () => emitted.filter((e) => e.event === 'huddle:started');

before(async () => {
  app = Fastify();
  // Stand-ins for the JWT hook and Socket.IO: whoever the header names is "signed in", and emits are recorded.
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: (room: string) => ({ emit: (event: string, payload: any) => emitted.push({ room, event, payload }) }) } as any);
  await app.register(huddleRoutes, { prefix: '/api/huddles' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@huddletest.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  a = await mk('caller');
  b = await mk('callee');
  const ws = await prisma.workspace.create({ data: { name: 'Huddle test', slug: `huddle-${run}`, ownerId: a.id } });
  workspaceId = ws.id;
  await prisma.workspaceMember.createMany({ data: [a, b].map((u) => ({ workspaceId, userId: u.id, role: 'MEMBER' as const })) });
  const ch = await prisma.channel.create({ data: { workspaceId, name: 'dm', type: 'DIRECT', createdById: a.id } });
  channelId = ch.id;
  await prisma.channelMember.createMany({ data: [a, b].map((u) => ({ channelId, userId: u.id })) });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@huddletest.example` } } });
  await prisma.$disconnect();
  await app.close();
});

describe('call announcements', () => {
  it('rings the callee when a call starts', async () => {
    assert.equal((await start(a.id)).statusCode, 200);
    const toCallee = started().filter((e) => e.room === `user:${b.id}`);
    assert.equal(toCallee.length, 1);
    assert.equal(toCallee[0].payload.hostUserId, a.id);
  });

  it('does not re-announce the call when the callee joins it', async () => {
    emitted.length = 0;
    assert.equal((await start(b.id)).statusCode, 200); // the callee answering also calls /start
    assert.deepEqual(started(), [], 'joining must not send the caller a "call from <callee>"');
    // still a single active huddle, hosted by the original caller
    const active = await prisma.huddle.findMany({ where: { channelId, isActive: true } });
    assert.equal(active.length, 1);
    assert.equal(active[0].hostUserId, a.id);
  });
});
