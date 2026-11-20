// Integration test for message search paging and minimum length. Real database; run against a migrated scratch DB.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { messageRoutes } from './messages.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let userId: string, workspaceId: string, channelId: string;

const search = (q: string, extra = '') =>
  app.inject({
    method: 'GET',
    url: `/api/messages/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}${extra}`,
    headers: { 'x-test-user': userId },
  });

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(messageRoutes, { prefix: '/api/messages' });

  const user = await prisma.user.create({
    data: { email: `s-${run}@search.example`, username: `s-${run}`, displayName: 'Searcher', passwordHash: 'x' },
  });
  userId = user.id;
  workspaceId = (await prisma.workspace.create({ data: { name: 'Search', slug: `search-${run}`, ownerId: userId } })).id;
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role: 'OWNER' } });
  channelId = (await prisma.channel.create({ data: { workspaceId, name: 'general', type: 'PUBLIC', createdById: userId } })).id;
  await prisma.channelMember.create({ data: { channelId, userId } });
  const t0 = Date.now() - 100_000;
  for (let i = 0; i < 25; i++) {
    // several share a timestamp so paging relies on the id tie-break
    await prisma.message.create({ data: { channelId, userId, content: `needle ${i}`, createdAt: new Date(t0 + Math.floor(i / 3) * 1000) } });
  }
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@search.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('message search', () => {
  it('returns nothing for a query shorter than 3 characters', async () => {
    for (const q of ['n', 'ne']) {
      const body = (await search(q)).json();
      assert.deepEqual(body.messages, []);
      assert.equal(body.hasMore, false);
    }
  });

  it('pages through every match with no gaps or repeats', async () => {
    const seen: string[] = [];
    let hasMore = true;
    for (let page = 1; hasMore && page < 10; page++) {
      const body = (await search('needle', `&limit=10&page=${page}`)).json();
      seen.push(...body.messages.map((m: any) => m.id));
      hasMore = body.hasMore;
      if (page === 1) assert.equal(body.total, 25, 'the first page reports the total');
      else assert.equal(body.total, null, 'later pages skip the count');
    }
    assert.equal(seen.length, 25);
    assert.equal(new Set(seen).size, 25);
  });

  it('says there is nothing more on the last page', async () => {
    const body = (await search('needle', '&limit=10&page=3')).json();
    assert.equal(body.messages.length, 5);
    assert.equal(body.hasMore, false);
  });
});
