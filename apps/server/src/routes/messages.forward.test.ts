// Integration test for forwarding (posting a message that quotes one from another channel). Real database; run against
// a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { channelRoutes } from './channels.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let me: string, other: string, workspaceId: string;
let general: string, random: string, secret: string, anon: string;

const forward = (quotedMessageId: string, to = random, content = '') =>
  app.inject({ method: 'POST', url: `/api/channels/${to}/messages`, payload: { content, quotedMessageId }, headers: { 'x-test-user': me } });
const post = async (channelId: string, extra = {}) =>
  (await prisma.message.create({ data: { channelId, userId: other, content: 'source text', ...extra } })).id;

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(channelRoutes, { prefix: '/api/channels' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@forward.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  const [a, b] = await Promise.all([mk('me'), mk('other')]);
  me = a.id;
  other = b.id;
  workspaceId = (await prisma.workspace.create({ data: { name: 'Forward', slug: `fwd-${run}`, ownerId: other } })).id;
  await prisma.workspaceMember.createMany({ data: [me, other].map((userId) => ({ workspaceId, userId, role: 'MEMBER' as const })) });
  const ch = (name: string, type: 'PUBLIC' | 'PRIVATE', isAnonymous = false) =>
    prisma.channel.create({ data: { workspaceId, name, type, isAnonymous, createdById: other } }).then((c) => c.id);
  [general, random, secret, anon] = await Promise.all([ch('general', 'PUBLIC'), ch('random', 'PUBLIC'), ch('secret', 'PRIVATE'), ch('anon', 'PUBLIC', true)]);
  await prisma.channelMember.create({ data: { channelId: secret, userId: other } });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@forward.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('forwarding a message', () => {
  it('posts it to another channel, with no note needed, carrying where it came from', async () => {
    const src = await post(general);
    const res = await forward(src);
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.channelId, random);
    assert.equal(body.quotedMessage.id, src);
    assert.equal(body.quotedMessage.content, 'source text');
    assert.equal(body.quotedMessage.channel.name, 'general');
    assert.equal(body.content, 'source text', 'the forward carries its own copy');
  });

  it('keeps its copy (text and files) when the original is deleted', async () => {
    const src = await post(general);
    await prisma.attachment.create({
      data: { workspaceId, channelId: general, messageId: src, uploaderId: other, fileName: 'a.png', fileKey: `k-${run}`, fileUrl: '/a.png', fileType: 'image/png', fileSize: 1 },
    });
    const fwd = (await forward(src)).json();
    // What the delete route does to the original
    await prisma.message.update({ where: { id: src }, data: { isDeleted: true, content: '' } });
    await prisma.attachment.updateMany({ where: { messageId: src }, data: { isDeleted: true } });

    const after = await prisma.message.findUniqueOrThrow({ where: { id: fwd.id }, include: { attachments: { where: { isDeleted: false } } } });
    assert.equal(after.content, 'source text');
    assert.equal(after.attachments.length, 1);
    assert.equal(after.attachments[0].uploaderId, other, 'the forwarder gains no right to delete the file');
  });

  it('refuses a message from a private channel the sender cannot read', async () => {
    assert.equal((await forward(await post(secret))).statusCode, 403);
  });

  it('refuses a message out of an anonymous channel, which would expose its author', async () => {
    assert.equal((await forward(await post(anon, { anonName: 'Fox' }))).statusCode, 400);
  });

  it('refuses a deleted message', async () => {
    assert.equal((await forward(await post(general, { isDeleted: true, content: '' }))).statusCode, 400);
  });

  it('still needs content when nothing is quoted', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/channels/${random}/messages`, payload: { content: '' }, headers: { 'x-test-user': me } });
    assert.equal(res.statusCode, 400);
  });
});
