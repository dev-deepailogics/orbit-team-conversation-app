// Integration tests for access/refresh token sessions. Real database; run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { prisma } from '@orbit/db';
import { authRoutes } from './auth.js';

const run = Date.now().toString(36);
const email = `refresh-${run}@refreshtest.example`;
const password = 'hunter22';
let app: FastifyInstance;

const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object });
const login = async () => (await post('/api/auth/login', { email, password })).json() as { accessToken: string; refreshToken: string };

before(async () => {
  app = Fastify();
  await app.register(jwt, { secret: 'test-jwt-secret' });
  app.decorate('authenticate', async () => {});
  await app.register(authRoutes, { prefix: '/api/auth' });
  await prisma.user.create({
    data: { email, username: `refresh-${run}`, displayName: 'Refresh', passwordHash: await bcrypt.hash(password, 4) },
  });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@refreshtest.example' } } });
  await prisma.$disconnect();
  await app.close();
});

describe('refresh tokens', () => {
  it('login returns a short-lived access token and a refresh token', async () => {
    const { accessToken, refreshToken } = await login();
    const claims = app.jwt.verify<{ exp: number; iat: number }>(accessToken);
    assert.ok(claims.exp - claims.iat <= 15 * 60, 'access token expires within 15 minutes');
    assert.ok(refreshToken.length >= 40);
    // only a hash is stored
    assert.equal(await prisma.refreshToken.count({ where: { tokenHash: refreshToken } }), 0);
  });

  it('rotates: new tokens work, the old refresh token does not', async () => {
    const first = await login();
    const res = await post('/api/auth/refresh', { refreshToken: first.refreshToken });
    assert.equal(res.statusCode, 200);
    const next = res.json();
    assert.notEqual(next.refreshToken, first.refreshToken);
    assert.equal(app.jwt.verify<{ username: string }>(next.accessToken).username, `refresh-${run}`);

    // Immediate replay is treated as a benign race: rejected, family stays alive
    assert.equal((await post('/api/auth/refresh', { refreshToken: first.refreshToken })).statusCode, 401);
    assert.equal((await post('/api/auth/refresh', { refreshToken: next.refreshToken })).statusCode, 200);
  });

  it('replaying a long-rotated token revokes the whole family', async () => {
    const first = await login();
    const second = (await post('/api/auth/refresh', { refreshToken: first.refreshToken })).json();
    // age the revocation past the grace window
    await prisma.refreshToken.updateMany({ where: { revokedAt: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } });

    assert.equal((await post('/api/auth/refresh', { refreshToken: first.refreshToken })).statusCode, 401);
    assert.equal((await post('/api/auth/refresh', { refreshToken: second.refreshToken })).statusCode, 401);
  });

  it('rejects unknown and expired refresh tokens', async () => {
    assert.equal((await post('/api/auth/refresh', { refreshToken: 'nope' })).statusCode, 401);
    assert.equal((await post('/api/auth/refresh', {})).statusCode, 400);

    const { refreshToken } = await login();
    await prisma.refreshToken.updateMany({ where: { user: { email } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await post('/api/auth/refresh', { refreshToken })).statusCode, 401);
  });

  it('logout revokes the session', async () => {
    const { refreshToken } = await login();
    assert.equal((await post('/api/auth/logout', { refreshToken })).statusCode, 200);
    assert.equal((await post('/api/auth/refresh', { refreshToken })).statusCode, 401);
  });

  it('a deactivated account cannot refresh', async () => {
    const { refreshToken } = await login();
    await prisma.user.update({ where: { email }, data: { disabled: true } });
    assert.equal((await post('/api/auth/refresh', { refreshToken })).statusCode, 403);
    await prisma.user.update({ where: { email }, data: { disabled: false } });
    assert.equal((await post('/api/auth/refresh', { refreshToken })).statusCode, 401); // revoked on deactivation
  });
});
