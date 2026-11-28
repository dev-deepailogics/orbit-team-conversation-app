import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { internalErrorHandler } from './errorHandler.js';

const SECRET = 'Invalid `prisma.user.findUnique()` invocation in E:\\app\\src\\routes\\auth.ts: database password=hunter2';

/** Same routes on two apps: one with Fastify's default error handler, one with ours. */
function buildApp(withHandler: boolean) {
  const app = Fastify({ logger: false });
  if (withHandler) app.setErrorHandler(internalErrorHandler);
  app.get('/crash', async () => {
    throw new Error(SECRET);
  });
  app.get('/crash-503', async () => {
    throw Object.assign(new Error(SECRET), { statusCode: 503 });
  });
  app.post('/validated', { schema: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } } }, async () => ({ ok: true }));
  app.get('/forbidden', async () => {
    throw Object.assign(new Error('You do not have access to this file'), { statusCode: 403 });
  });
  app.get('/rate-limited', async () => {
    // Shape thrown by @fastify/rate-limit's errorResponseBuilder in index.ts
    throw { statusCode: 429, error: 'Too many requests. Please wait a moment and try again.' };
  });
  return app;
}

test('unexpected errors never leak their message', async () => {
  const app = buildApp(true);
  for (const [url, code] of [['/crash', 500], ['/crash-503', 503]] as const) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, code);
    assert.ok(!res.body.includes('prisma'), 'internal error text must not reach the client');
    assert.ok(!res.body.includes('hunter2'));
    const body = res.json();
    assert.equal(body.error, 'Internal Server Error');
    assert.equal(body.message, 'Something went wrong on our side. Please try again.');
    assert.equal(typeof body.requestId, 'string');
  }
  await app.close();
});

test('client errors (4xx) are exactly the same as Fastify default', async () => {
  const ours = buildApp(true);
  const fastifyDefault = buildApp(false);
  const cases = [
    { method: 'POST' as const, url: '/validated', payload: {} }, // schema validation 400
    { method: 'POST' as const, url: '/validated', payload: 'not json', headers: { 'content-type': 'application/json' } }, // bad JSON 400
    { method: 'GET' as const, url: '/forbidden' }, // 403 with a user-facing message
    { method: 'GET' as const, url: '/rate-limited' }, // 429 object
    { method: 'GET' as const, url: '/missing-route' }, // 404
  ];
  for (const c of cases) {
    const a = await ours.inject(c);
    const b = await fastifyDefault.inject(c);
    assert.equal(a.statusCode, b.statusCode, `${c.method} ${c.url} status`);
    assert.equal(a.body, b.body, `${c.method} ${c.url} body`);
    assert.ok(a.statusCode >= 400 && a.statusCode < 500);
  }
  await ours.close();
  await fastifyDefault.close();
});
