// Integration test for ticket types. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { projectRoutes } from './projects.js';

const run = Date.now().toString(36);
let app: FastifyInstance;
let userId: string, workspaceId: string, projectId: string, columnId: string;

const call = (method: 'POST' | 'PUT', url: string, payload: object) =>
  app.inject({ method, url: `/api/projects/${projectId}${url}`, payload, headers: { 'x-test-user': userId } });
const create = (extra: object = {}) => call('POST', '/tickets', { columnId, title: 'A ticket', ...extra });

before(async () => {
  app = Fastify();
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: req.headers['x-test-user'], username: 'tester' };
  });
  app.decorate('io', { to: () => ({ emit: () => {} }) } as any);
  await app.register(projectRoutes, { prefix: '/api/projects' });

  const user = await prisma.user.create({
    data: { email: `types-${run}@tickettest.example`, username: `types-${run}`, displayName: 'Types', passwordHash: 'x' },
  });
  userId = user.id;
  const ws = await prisma.workspace.create({ data: { name: 'Ticket types', slug: `types-${run}`, ownerId: userId } });
  workspaceId = ws.id;
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role: 'OWNER' } });
  const project = await prisma.project.create({ data: { workspaceId, name: 'P', createdById: userId } });
  projectId = project.id;
  columnId = (await prisma.projectColumn.create({ data: { projectId, name: 'To do' } })).id;
});

after(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@tickettest.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('ticket type', () => {
  it('defaults to TASK when none is given', async () => {
    const res = await create();
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().type, 'TASK');
  });

  it('stores the type a ticket is created with', async () => {
    for (const type of ['BUG', 'STORY', 'EPIC']) {
      const res = await create({ type });
      assert.equal(res.statusCode, 201, res.body);
      assert.equal(res.json().type, type);
    }
  });

  it('rejects an unknown type', async () => {
    const res = await create({ type: 'FEATURE' });
    assert.equal(res.statusCode, 400);
  });

  it('changes the type on update, and leaves it alone when not sent', async () => {
    const ticket = (await create({ type: 'BUG' })).json();
    const changed = await call('PUT', `/tickets/${ticket.id}`, { type: 'STORY' });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().type, 'STORY');

    const renamed = await call('PUT', `/tickets/${ticket.id}`, { title: 'Renamed' });
    assert.equal(renamed.json().type, 'STORY');
    assert.equal((await call('PUT', `/tickets/${ticket.id}`, { type: 'nope' })).statusCode, 400);
  });
});
