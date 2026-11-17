// Integration test for call announcements. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { LiveKitService } from '../services/livekit.js';
import { huddleRoutes } from './huddles.js';

process.env.HUDDLE_EMPTY_RECHECK_MS = '60'; // so the "everyone left at once" re-check runs quickly

const run = Date.now().toString(36);
let app: FastifyInstance;
let a: { id: string }, b: { id: string }, c: { id: string }, channelId: string, workspaceId: string;
const emitted: { room: string; event: string; payload: any }[] = [];

const start = (userId: string, channel = channelId) =>
  app.inject({ method: 'POST', url: `/api/huddles/${channel}/start`, headers: { 'x-test-user': userId } });
const end = (userId: string, channel = channelId) =>
  app.inject({ method: 'POST', url: `/api/huddles/${channel}/end`, headers: { 'x-test-user': userId } });
const activeHuddles = (channel: string) => prisma.huddle.count({ where: { channelId: channel, isActive: true } });

// Stand-in for the LiveKit room: whoever is in `inRoom` is connected. Records deleted rooms.
let inRoom: string[] = [];
let deletedRooms: string[] = [];
(LiveKitService as any).listParticipants = async () => inRoom.map((identity) => ({ identity }));
(LiveKitService as any).deleteRoom = async (room: string) => void deletedRooms.push(room);
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
  c = await mk('third');
  const ws = await prisma.workspace.create({ data: { name: 'Huddle test', slug: `huddle-${run}`, ownerId: a.id } });
  workspaceId = ws.id;
  await prisma.workspaceMember.createMany({ data: [a, b, c].map((u) => ({ workspaceId, userId: u.id, role: 'MEMBER' as const })) });
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

describe('leaving a call', () => {
  let groupId: string;
  before(async () => {
    const g = await prisma.channel.create({ data: { workspaceId, name: `group-${run}`, type: 'PRIVATE', createdById: a.id } });
    groupId = g.id;
    await prisma.channelMember.createMany({ data: [a, b, c].map((u) => ({ channelId: groupId, userId: u.id })) });
  });
  const reset = () => {
    emitted.length = 0;
    deletedRooms = [];
  };
  const ended = () => emitted.filter((e) => e.event === 'huddle:ended');
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('a direct call ends for both people when either leaves', async () => {
    reset();
    await start(a.id); // the channel's call from the tests above is still active; /start joins it
    inRoom = [a.id, b.id];
    const res = await end(a.id);
    assert.equal(res.json().ended, true);
    assert.equal(await activeHuddles(channelId), 0);
    assert.equal(ended().length, 1);
  });

  it('a group call carries on when one person leaves', async () => {
    reset();
    await start(a.id, groupId);
    inRoom = [a.id, b.id, c.id];
    const res = await end(a.id, groupId); // the person who started it leaves
    assert.equal(res.json().ended, false);
    assert.equal(await activeHuddles(groupId), 1);
    assert.deepEqual(deletedRooms, [], 'the media room must stay up for the others');
    assert.deepEqual(ended(), [], 'nobody is told the call ended');
  });

  it('a group call ends when the last person leaves', async () => {
    inRoom = [b.id, c.id];
    assert.equal((await end(b.id, groupId)).json().ended, false);
    inRoom = [c.id]; // only the last person is left, and they leave too
    const res = await end(c.id, groupId);
    assert.equal(res.json().ended, true);
    assert.equal(await activeHuddles(groupId), 0);
    assert.deepEqual(deletedRooms, [`orbit-huddle-${groupId}`]);
    assert.equal(ended().length, 1);
  });

  it('a group call still ends when the last two people leave at the same moment', async () => {
    reset();
    await start(a.id, groupId);
    inRoom = [b.id, c.id];
    // each sees the other still connected, so neither /end ends it
    assert.equal((await end(b.id, groupId)).json().ended, false);
    assert.equal((await end(c.id, groupId)).json().ended, false);
    inRoom = []; // both have now disconnected
    await sleep(250);
    assert.equal(await activeHuddles(groupId), 0, 'the delayed re-check closes the empty call');
    assert.equal(ended().length, 1);
  });
});

describe('call thread log', () => {
  let groupId: string;
  const chat = (userId: string, body: object) =>
    app.inject({ method: 'POST', url: `/api/huddles/${groupId}/chat`, payload: body, headers: { 'x-test-user': userId } });
  const record = () => prisma.message.findFirst({ where: { channelId: groupId, userId: a.id, parentMessageId: null } });
  const thread = async () => {
    const r = await record();
    const replies = await prisma.message.findMany({ where: { parentMessageId: r!.id }, orderBy: { createdAt: 'asc' } });
    return replies.map((m) => [m.userId === a.id ? 'a' : m.userId === b.id ? 'b' : 'c', m.content]);
  };

  before(async () => {
    const g = await prisma.channel.create({ data: { workspaceId, name: `log-${run}`, type: 'PRIVATE', createdById: a.id } });
    groupId = g.id;
    await prisma.channelMember.createMany({ data: [a, b, c].map((u) => ({ channelId: groupId, userId: u.id })) });
  });

  it('logs nothing for chat when there is no call running', async () => {
    const res = await chat(a.id, { text: 'hello?' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().logged, false);
    assert.equal(await prisma.message.count({ where: { channelId: groupId } }), 0);
  });

  it('rejects empty chat text', async () => {
    assert.equal((await chat(a.id, { text: '   ' })).statusCode, 400);
    assert.equal((await chat(a.id, {})).statusCode, 400);
  });

  it('puts in-call chat in the call thread, and says who joined', async () => {
    emitted.length = 0;
    await start(a.id, groupId); // starting a call is not logged as a join: the call record already says who started it
    assert.deepEqual(await thread(), []);

    await start(b.id, groupId); // b joins
    await start(b.id, groupId); // the same join reported twice is only logged once
    assert.equal((await chat(b.id, { text: 'can everyone hear me?' })).json().logged, true);
    await chat(a.id, { text: 'yes' });

    assert.deepEqual(await thread(), [
      ['b', '📞 Joined the call'],
      ['b', 'can everyone hear me?'],
      ['a', 'yes'],
    ]);
    const live = emitted.filter((e) => e.event === 'message:new' && e.payload.isThreadReply);
    assert.equal(live.length, 3, 'each entry is broadcast to the channel like a thread reply');
  });

  it('logs when a specific person leaves, once, and the call goes on for the others', async () => {
    inRoom = [a.id, b.id, c.id];
    assert.equal((await end(b.id, groupId)).json().ended, false);
    await end(b.id, groupId); // client reports the same leave again after disconnecting
    const entries = await thread();
    assert.deepEqual(entries.filter(([, text]) => text === '📞 Left the call'), [['b', '📞 Left the call']]);
    assert.equal(await activeHuddles(groupId), 1);
  });

  it('logs a rejoin and the final leave, then the call record shows it ended', async () => {
    await start(b.id, groupId); // b comes back
    inRoom = [a.id];
    assert.equal((await end(a.id, groupId)).json().ended, true); // last person leaves
    assert.deepEqual(await thread(), [
      ['b', '📞 Joined the call'],
      ['b', 'can everyone hear me?'],
      ['a', 'yes'],
      ['b', '📞 Left the call'],
      ['b', '📞 Joined the call'], // b came back
      ['a', '📞 Left the call'], // and a, the last one, left
    ]);
    const r = await record();
    assert.match(r!.content, /^📞 Call ended · lasted/);
  });
});
