// Integration test for who gets told about ticket assignments and edits. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { projectRoutes } from './projects.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let u: Record<'actor' | 'bob' | 'cara' | 'dan', string>;
let workspaceId: string, projectId: string, todo: string, doing: string, channelId: string;

const call = (method: 'POST' | 'PUT', url: string, payload: object, as: keyof typeof u = 'actor') =>
  app.inject({ method, url: `/api/projects/${projectId}${url}`, payload, headers: { 'x-test-user': u[as] } });
const newTicket = async (extra: object = {}, as: keyof typeof u = 'cara') =>
  (await call('POST', '/tickets', { columnId: todo, title: 'Fix the login page', ...extra }, as)).json();
const notifs = (who: keyof typeof u) => prisma.notification.findMany({ where: { userId: u[who] }, orderBy: { createdAt: 'asc' } });
const botMessages = () => prisma.message.count({ where: { channelId, botAppId: { not: null } } });
const last = async (who: keyof typeof u) => (await notifs(who)).at(-1)?.body ?? null;
const lastBotMessage = async () =>
  (await prisma.message.findFirst({ where: { channelId, botAppId: { not: null } }, orderBy: { createdAt: 'desc' } }))?.content ?? null;

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(projectRoutes, { prefix: '/api/projects' });

  const mk = (n: string) =>
    prisma.user.create({ data: { email: `${n}-${run}@ticketnotify.example`, username: `${n}-${run}`, displayName: n, passwordHash: 'x' } });
  const [actor, bob, cara, dan] = await Promise.all(['actor', 'bob', 'cara', 'dan'].map(mk));
  u = { actor: actor.id, bob: bob.id, cara: cara.id, dan: dan.id };
  const ws = await prisma.workspace.create({ data: { name: 'Ticket notify', slug: `notify-${run}`, ownerId: actor.id } });
  workspaceId = ws.id;
  await prisma.workspaceMember.createMany({ data: [actor, bob, cara, dan].map((x) => ({ workspaceId, userId: x.id, role: 'MEMBER' as const })) });
  const ch = await prisma.channel.create({ data: { workspaceId, name: 'general', type: 'PUBLIC', createdById: actor.id } });
  channelId = ch.id;
  projectId = (await prisma.project.create({ data: { workspaceId, name: 'Site', createdById: actor.id, notificationChannelId: channelId } })).id;
  todo = (await prisma.projectColumn.create({ data: { projectId, name: 'To do' } })).id;
  doing = (await prisma.projectColumn.create({ data: { projectId, name: 'Doing' } })).id;
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@ticketnotify.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('assigning a ticket', () => {
  it('tells the new assignee, and not the person who assigned', async () => {
    const t = await newTicket();
    assert.equal((await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob })).statusCode, 200);
    assert.match((await last('bob'))!, /actor assigned you to ticket "Fix the login page"/);
    assert.equal((await notifs('actor')).length, 0);
  });

  it('names the assignee in the shared channel message (everyone reads it, so never "you")', async () => {
    const t = await newTicket({ title: 'Created unassigned' }); // e.g. made from a chat message
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.dan });
    const msg = (await lastBotMessage())!;
    assert.match(msg, /actor assigned dan to ticket \*\*"Created unassigned"\*\*/);
    assert.doesNotMatch(msg, /assigned you/);
    assert.match((await last('dan'))!, /actor assigned you to ticket "Created unassigned"/, 'the assignee is still told "you"');
  });

  it('tells someone who is assigned again after being replaced (the web form sends one assignee at a time)', async () => {
    const t = await newTicket({ title: 'Reassign me' });
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob });
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.dan });
    const before = (await notifs('bob')).length;
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob }); // bob again
    assert.equal((await notifs('bob')).length, before + 1, 'bob must hear about being assigned again');
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    assert.deepEqual((stored.assignees as any[]).map((a) => a.uid), [u.bob], 'the assignee list follows the single assignee');
  });

  it('does not notify when the assignee is unchanged by a later save', async () => {
    const t = await newTicket({ title: 'Steady' });
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob });
    const before = (await notifs('bob')).length;
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob, title: 'Steady' });
    assert.equal((await notifs('bob')).length, before);
  });
});

describe('editing a ticket', () => {
  it('tells the assignee and the creator what changed, not the editor', async () => {
    const t = await newTicket({ title: 'Edit me', assigneeId: u.bob }); // created by cara, assigned to bob
    const bobBefore = (await notifs('bob')).length;
    const caraBefore = (await notifs('cara')).length;
    await call('PUT', `/tickets/${t.id}`, { title: 'Edit me please', priority: 'HIGH' });
    assert.equal((await notifs('bob')).length, bobBefore + 1);
    assert.equal((await notifs('cara')).length, caraBefore + 1);
    assert.match((await last('bob'))!, /actor edited ticket \(title, priority\) "Edit me please"/);
    assert.equal((await notifs('actor')).length, 0, 'the person who edited is not notified');
  });

  it('says nothing when a save changes nothing, or only ticks a checklist item', async () => {
    const t = await newTicket({ title: 'Quiet', assigneeId: u.bob, description: 'same' });
    const before = (await notifs('bob')).length;
    const messages = await botMessages();
    // the edit form re-sends every field, unchanged
    await call('PUT', `/tickets/${t.id}`, { title: 'Quiet', description: 'same', priority: 'MEDIUM', assigneeId: u.bob, dueDate: null });
    await call('PUT', `/tickets/${t.id}`, { checklist: [{ id: '1', text: 'x', completed: true }] });
    assert.equal((await notifs('bob')).length, before);
    assert.equal(await botMessages(), messages);
  });

  it('tells watchers too', async () => {
    const t = await newTicket({ title: 'Watched' });
    await prisma.ticket.update({ where: { id: t.id }, data: { watchers: [u.dan] } });
    await call('PUT', `/tickets/${t.id}`, { priority: 'URGENT' });
    assert.match((await last('dan'))!, /edited ticket \(priority\)/);
  });

  it('tells people when the column is changed from the edit form', async () => {
    const t = await newTicket({ title: 'Moving', assigneeId: u.bob });
    const before = (await notifs('bob')).length;
    await call('PUT', `/tickets/${t.id}`, { columnId: doing });
    assert.equal((await notifs('bob')).length, before + 1);
    assert.match((await last('bob'))!, /actor moved ticket to "Doing" "Moving"/);
  });

  it('a save that both assigns and edits posts one channel message, and each person hears the right thing', async () => {
    const t = await newTicket({ title: 'Both' }); // created by cara
    const messages = await botMessages();
    await call('PUT', `/tickets/${t.id}`, { assigneeId: u.bob, priority: 'LOW' });
    assert.equal(await botMessages(), messages + 1, 'one activity message, not two');
    assert.match((await lastBotMessage())!, /actor assigned bob to ticket \*\*"Both"\*\*/, 'the channel just says who was assigned');
    assert.match((await last('bob'))!, /assigned you to ticket/);
    assert.match((await last('cara'))!, /edited ticket \(priority\)/);
  });
});
