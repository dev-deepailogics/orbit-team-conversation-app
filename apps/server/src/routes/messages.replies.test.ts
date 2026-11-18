// Integration test for paged thread replies. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { messageRoutes } from './messages.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let userId: string, workspaceId: string, channelId: string, parentId: string, otherParentId: string;
let allIds: string[]; // the 12 replies, oldest to newest

const get = (query = '', id = parentId) =>
  app.inject({ method: 'GET', url: `/api/messages/${id}/replies${query}`, headers: { 'x-test-user': userId } });
const ids = (res: any) => res.json().replies.map((r: any) => r.id);

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(messageRoutes, { prefix: '/api/messages' });

  const user = await prisma.user.create({
    data: { email: `pager-${run}@replies.example`, username: `pager-${run}`, displayName: 'Pager', passwordHash: 'x' },
  });
  userId = user.id;
  const ws = await prisma.workspace.create({ data: { name: 'Replies', slug: `replies-${run}`, ownerId: userId } });
  workspaceId = ws.id;
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role: 'OWNER' } });
  channelId = (await prisma.channel.create({ data: { workspaceId, name: 'general', type: 'PUBLIC', createdById: userId } })).id;
  await prisma.channelMember.create({ data: { channelId, userId } });
  parentId = (await prisma.message.create({ data: { channelId, userId, content: 'parent' } })).id;
  otherParentId = (await prisma.message.create({ data: { channelId, userId, content: 'another parent' } })).id;

  const t0 = Date.now() - 60_000;
  allIds = [];
  for (let i = 0; i < 12; i++) {
    // replies 5 and 6 share a timestamp, so the order between them depends on the tie-break
    const createdAt = new Date(t0 + (i === 6 ? 5 : i) * 1000);
    allIds.push((await prisma.message.create({ data: { channelId, userId, parentMessageId: parentId, content: `reply ${i}`, createdAt } })).id);
  }
  await prisma.message.create({ data: { channelId, userId, parentMessageId: otherParentId, content: 'in the other thread' } });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@replies.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('paged thread replies', () => {
  it('returns the newest replies first page, oldest to newest, and says there are more', async () => {
    const res = await get('?limit=5');
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.replies.length, 5);
    assert.equal(body.hasMore, true);
    assert.equal(body.parent.id, parentId, 'the first page includes the parent');
    assert.equal(body.parent.replyCount, 12, 'the parent carries the total, not just this page');
    assert.equal(body.nextCursor, body.replies[0].id, 'the cursor is the oldest reply on the page');
    const times = body.replies.map((r: any) => new Date(r.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'oldest to newest within the page');
    assert.equal(body.replies.at(-1).content, 'reply 11', 'the page ends at the newest reply');
  });

  it('walks back through the whole thread with no gaps or repeats', async () => {
    const seen: string[][] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page++) {
      const res: any = await get(`?limit=5${cursor ? `&cursor=${cursor}` : ''}`);
      assert.equal(res.statusCode, 200);
      const body = res.json();
      seen.unshift(body.replies.map((r: any) => r.id)); // older pages go in front
      if (!body.hasMore) {
        assert.equal(body.nextCursor, null);
        break;
      }
      cursor = body.nextCursor;
    }
    assert.deepEqual(seen.map((p) => p.length), [2, 5, 5], 'pages of 5, 5 and the remaining 2');
    const flat = seen.flat();
    assert.equal(new Set(flat).size, 12, 'no repeats');
    assert.deepEqual([...flat].sort(), [...allIds].sort(), 'every reply, none missing');
  });

  it('older pages omit nothing else from the thread but leave out the parent', async () => {
    const first = (await get('?limit=5')).json();
    const older = (await get(`?limit=5&cursor=${first.nextCursor}`)).json();
    assert.equal(older.parent.id, parentId, 'the parent is still returned (clients ignore it)');
    assert.ok(older.replies.every((r: any) => r.parentMessageId === parentId), 'only this thread’s replies');
  });

  it('returns everything when no limit is given, as older app builds expect', async () => {
    const body = (await get()).json();
    assert.equal(body.replies.length, 12);
    assert.equal(body.hasMore, false);
    assert.deepEqual(ids({ json: () => body }).length, 12);
    assert.equal(body.replies[0].content, 'reply 0', 'oldest first');
  });

  it('a short thread fits in one page', async () => {
    const body = (await get('?limit=30')).json();
    assert.equal(body.replies.length, 12);
    assert.equal(body.hasMore, false);
    assert.equal(body.nextCursor, null);
  });

  it('refuses a cursor that belongs to another thread', async () => {
    const stray = await prisma.message.findFirstOrThrow({ where: { parentMessageId: otherParentId } });
    assert.equal((await get(`?limit=5&cursor=${stray.id}`)).statusCode, 400);
    assert.equal((await get('?limit=5&cursor=not-a-real-id')).statusCode, 400);
  });

  it('keeps the page size within bounds', async () => {
    assert.equal((await get('?limit=1')).json().replies.length, 5, 'at least 5');
    assert.equal((await get('?limit=9999')).json().replies.length, 12, 'at most 100 (here, all 12)');
    assert.equal((await get('?limit=abc')).json().replies.length, 12, 'garbage falls back to the default of 30');
  });
});
