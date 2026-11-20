// Integration test for screen recordings: upload validation, library privacy, view counting,
// attach rules and file cleanup. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { prisma } from '@orbit/db';

// Files go to a throwaway folder; storage reads UPLOAD_DIR when the module first loads.
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-rec-test-'));
process.env.UPLOAD_DIR = uploadDir;

const run = Date.now().toString(36);
let app: FastifyInstance;
let alice: string, bob: string, carol: string;
let workspaceId: string, otherWorkspaceId: string;
let general: string, dmAliceBob: string, anon: string, foreignChannel: string;

const as = (userId: string) => ({ 'x-test-user': userId });
const fileExists = (url?: string | null) =>
  !!url && fs.existsSync(path.join(uploadDir, decodeURIComponent(url.replace('/api/files/download/', ''))));

async function upload(
  userId: string,
  opts: { channelId?: string; ws?: string; durationSec?: number; mime?: string; bytes?: number; thumbnail?: boolean } = {},
) {
  const fd = new FormData();
  fd.append('workspaceId', opts.ws ?? workspaceId);
  if (opts.channelId) fd.append('channelId', opts.channelId);
  fd.append('title', 'Demo clip');
  fd.append('durationSec', String(opts.durationSec ?? 12));
  // 1x1 transparent PNG
  if (opts.thumbnail) fd.append('thumbnailDataUrl', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
  fd.append('file', new Blob([new Uint8Array(opts.bytes ?? 2048)], { type: opts.mime ?? 'video/webm;codecs=vp8,opus' }), 'recording.webm');
  const req = new Request('http://local/upload', { method: 'POST', body: fd });
  return app.inject({
    method: 'POST',
    url: '/api/recordings/upload',
    payload: Buffer.from(await req.arrayBuffer()),
    headers: { ...as(userId), 'content-type': req.headers.get('content-type')! },
  });
}

before(async () => {
  const { recordingRoutes } = await import('./recordings.js');
  app = Fastify();
  await app.register(jwt, { secret: 'test-jwt-secret' }); // the public view endpoint reads an optional bearer token
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }), emit: () => {} } as any);
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // same global cap as index.ts
  await app.register(recordingRoutes, { prefix: '/api/recordings' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@rec.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  [alice, bob, carol] = (await Promise.all([mk('alice'), mk('bob'), mk('carol')])).map((u) => u.id);
  const ws = (slug: string) => prisma.workspace.create({ data: { name: 'Rec', slug: `${slug}-${run}`, ownerId: alice } });
  workspaceId = (await ws('rec')).id;
  otherWorkspaceId = (await ws('rec-other')).id;
  await prisma.workspaceMember.createMany({
    data: [
      ...[alice, bob, carol].map((userId) => ({ workspaceId, userId, role: 'MEMBER' as const })),
      { workspaceId: otherWorkspaceId, userId: alice, role: 'MEMBER' as const },
    ],
  });
  const ch = (data: any) => prisma.channel.create({ data: { createdById: alice, ...data } }).then((c) => c.id);
  general = await ch({ workspaceId, name: 'general', type: 'PUBLIC' });
  dmAliceBob = await ch({ workspaceId, name: `dm-${run}`, type: 'DIRECT' });
  anon = await ch({ workspaceId, name: 'anon', type: 'PUBLIC', isAnonymous: true });
  foreignChannel = await ch({ workspaceId: otherWorkspaceId, name: 'elsewhere', type: 'PUBLIC' });
  await prisma.channelMember.createMany({ data: [alice, bob].map((userId) => ({ channelId: dmAliceBob, userId })) });
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@rec.example' } } });
  await prisma.$disconnect();
  await app.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

describe('recording uploads', () => {
  it('accepts a WebM clip and stores the video and thumbnail', async () => {
    const res = await upload(alice, { thumbnail: true });
    assert.equal(res.statusCode, 201, res.body);
    const rec = res.json();
    assert.equal(rec.attachment.fileType, 'video/webm', 'codec parameters are stripped');
    assert.ok(fileExists(rec.attachment.fileUrl) && fileExists(rec.thumbnailUrl));
  });

  it('accepts clips above the 50 MB global upload limit (recordings have their own cap)', async () => {
    const res = await upload(alice, { bytes: 51 * 1024 * 1024 });
    assert.equal(res.statusCode, 201, res.body);
  });

  it('rejects clips over the size cap with 413 and leaves no partial file behind', async () => {
    const { RECORDING_LIMITS } = await import('@orbit/types');
    const limits = RECORDING_LIMITS as { maxBytes: number };
    const original = limits.maxBytes;
    limits.maxBytes = 1024 * 1024; // shrink the cap instead of generating a 150 MB body
    const countFiles = () => fs.readdirSync(uploadDir, { recursive: true }).filter((f) => fs.statSync(path.join(uploadDir, String(f))).isFile()).length;
    try {
      const before = countFiles();
      const res = await upload(alice, { bytes: 2 * 1024 * 1024, thumbnail: true });
      assert.equal(res.statusCode, 413, res.body);
      assert.equal(countFiles(), before, 'no orphaned partial upload');
    } finally {
      limits.maxBytes = original;
    }
  });

  it('rejects non-video files (they are served inline, so HTML would be an XSS vector)', async () => {
    const res = await upload(alice, { mime: 'text/html' });
    assert.equal(res.statusCode, 415);
  });

  it('rejects clips longer than 5 minutes', async () => {
    assert.equal((await upload(alice, { durationSec: 301 })).statusCode, 201, 'within the grace period');
    assert.equal((await upload(alice, { durationSec: 3600 })).statusCode, 400);
  });

  it('refuses anonymous channels and channels from another workspace', async () => {
    assert.equal((await upload(alice, { channelId: anon })).statusCode, 400);
    assert.equal((await upload(alice, { channelId: foreignChannel })).statusCode, 400);
  });

  it("refuses a DM channel the uploader isn't in", async () => {
    assert.equal((await upload(carol, { channelId: dmAliceBob })).statusCode, 403);
  });
});

describe('video library', () => {
  it("hides DM clips from people outside the DM, and pages results", async () => {
    const dmClip = (await upload(alice, { channelId: dmAliceBob })).json();
    const list = (userId: string, qs = '') =>
      app.inject({ method: 'GET', url: `/api/recordings/workspace/${workspaceId}?limit=2${qs}`, headers: as(userId) });

    const all = async (userId: string) => {
      const ids: string[] = [];
      for (let offset = 0; ; offset += 2) {
        const page = (await list(userId, `&offset=${offset}`)).json();
        ids.push(...page.recordings.map((r: any) => r.id));
        if (!page.hasMore) return ids;
      }
    };
    assert.ok((await all(bob)).includes(dmClip.id), 'DM member sees it');
    assert.ok(!(await all(carol)).includes(dmClip.id), 'outsider does not');
    assert.equal((await list(alice)).json().recordings.length, 2, 'page size respected');
  });
});

describe('sharing and views', () => {
  it('reads a public link without counting a view, and counts real playback', async () => {
    const rec = (await upload(alice, { channelId: general })).json();
    const view = await app.inject({ method: 'GET', url: `/api/recordings/share/${rec.shareSlug}` });
    assert.equal(view.statusCode, 200);
    assert.equal(view.json().viewCount, 0);
    assert.equal(view.json().attachment.fileKey, undefined, 'storage internals are not exposed');

    assert.equal((await app.inject({ method: 'POST', url: `/api/recordings/share/${rec.shareSlug}/view` })).statusCode, 204);
    assert.equal((await app.inject({ method: 'GET', url: `/api/recordings/share/${rec.shareSlug}` })).json().viewCount, 1);
  });

  it("shows the creator who has and hasn't seen a clip shared in a DM", async () => {
    const rec = (await upload(alice)).json(); // library upload, then posted into the Alice-Bob DM
    await prisma.message.create({ data: { channelId: dmAliceBob, userId: alice, content: `look http://x/clip/${rec.shareSlug}` } });
    const play = (userId?: string) =>
      app.inject({
        method: 'POST',
        url: `/api/recordings/share/${rec.shareSlug}/view`,
        headers: userId ? { authorization: `Bearer ${app.jwt.sign({ id: userId })}` } : {},
      });
    const viewers = (userId: string) => app.inject({ method: 'GET', url: `/api/recordings/${rec.id}/viewers`, headers: as(userId) });

    let body = (await viewers(alice)).json();
    assert.deepEqual(body.sharedIn.map((c: any) => [c.type, c.name]), [['DIRECT', 'bob']]);
    assert.deepEqual(body.notSeen.map((u: any) => u.id), [bob]);

    await play(alice); // the creator's own plays don't count
    await play(bob);
    await play(bob);
    await play(); // anonymous public-link play: counted, but nobody to list
    await app.inject({ method: 'POST', url: `/api/recordings/share/${rec.shareSlug}/view`, headers: { authorization: 'Bearer junk' } });

    body = (await viewers(alice)).json();
    assert.equal(body.viewCount, 4);
    assert.deepEqual(body.seen.map((v: any) => [v.user.id, v.plays]), [[bob, 2]]);
    assert.deepEqual(body.notSeen, []);
    assert.equal((await viewers(bob)).statusCode, 403, 'receipts are for the creator only');
  });

  it("only attaches a clip to the creator's own message in the same channel", async () => {
    const rec = (await upload(alice, { channelId: general })).json();
    const bobsMessage = await prisma.message.create({ data: { channelId: general, userId: bob, content: 'hi' } });
    const ownMessage = await prisma.message.create({ data: { channelId: general, userId: alice, content: 'clip' } });
    const attach = (messageId: string) =>
      app.inject({ method: 'POST', url: `/api/recordings/${rec.id}/attach`, payload: { messageId }, headers: as(alice) });

    assert.equal((await attach(bobsMessage.id)).statusCode, 404);
    assert.equal((await attach(ownMessage.id)).statusCode, 200);
  });

  it('deleting removes the video and thumbnail files', async () => {
    const rec = (await upload(alice, { thumbnail: true })).json();
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/recordings/${rec.id}`, headers: as(bob) })).statusCode, 403);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/recordings/${rec.id}`, headers: as(alice) })).statusCode, 200);
    assert.ok(!fileExists(rec.attachment.fileUrl) && !fileExists(rec.thumbnailUrl));
    assert.equal((await app.inject({ method: 'GET', url: `/api/recordings/share/${rec.shareSlug}` })).statusCode, 404);
  });
});
