// Integration tests for Sign in with Microsoft. Microsoft's token + JWKS endpoints are mocked via fetch;
// the database is real. Run against a migrated scratch DB:
//   DATABASE_URL=postgresql://.../orbit_test npm test -w @orbit/server
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { prisma } from '@orbit/db';
import { authRoutes } from './auth.js';

const CLIENT_ID = 'test-client-id';
const TID = '11111111-2222-3333-4444-555555555555';
const run = Date.now().toString(36);
const email = (name: string) => `${name}-${run}@mstest.example`;

let app: FastifyInstance;
let privateKey: CryptoKey;
let tokenResponse: () => Promise<Response>;
let lastTokenRequest: URLSearchParams;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const idToken = (claims: Record<string, unknown>) =>
  new SignJWT({ tid: TID, name: 'Test User', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(`https://login.microsoftonline.com/${(claims.tid as string) ?? TID}/v2.0`)
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

/** Hits the start route; returns the cookie and the authorize URL params Microsoft would receive. */
async function startLogin() {
  const res = await app.inject({ method: 'GET', url: '/api/auth/microsoft' });
  assert.equal(res.statusCode, 302);
  const params = new URL(res.headers.location as string).searchParams;
  const cookie = (res.headers['set-cookie'] as string).split(';')[0];
  return { cookie, state: params.get('state')!, nonce: params.get('nonce')!, challenge: params.get('code_challenge')! };
}

async function callback(query: string, cookie?: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/auth/microsoft/callback?${query}`,
    headers: cookie ? { cookie } : {},
  });
  assert.equal(res.statusCode, 302);
  return res.headers.location as string;
}

/** Full happy-path round trip with the given ID token claims (nonce filled in automatically). */
async function login(claims: Record<string, unknown>) {
  const { cookie, state, nonce } = await startLogin();
  const token = await idToken({ nonce, ...claims });
  tokenResponse = async () => json({ id_token: token, access_token: 'unused' });
  return callback(`code=abc&state=${state}`, cookie);
}

const tokenFrom = (location: string) => {
  assert.match(location, /^http:\/\/localhost:3000\/login#token=/);
  return app.jwt.verify<{ id: string }>(decodeURIComponent(location.split('#token=')[1]));
};

before(async () => {
  process.env.MICROSOFT_CLIENT_ID = CLIENT_ID;
  process.env.MICROSOFT_CLIENT_SECRET = 'test-secret';
  process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:4000/api/auth/microsoft/callback';
  process.env.MICROSOFT_TENANT_ID = 'common';
  delete process.env.CLIENT_URL;

  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

  mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://login.microsoftonline.com/common/discovery/v2.0/keys') return json({ keys: [publicJwk] });
    if (url === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
      lastTokenRequest = new URLSearchParams(String(init?.body));
      return tokenResponse();
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  app = Fastify();
  await app.register(jwt, { secret: 'test-jwt-secret' });
  app.decorate('authenticate', async () => {});
  await app.register(authRoutes, { prefix: '/api/auth' });
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@mstest.example`, mode: 'insensitive' } } });
  await prisma.$disconnect();
  await app.close();
});

beforeEach(() => {
  tokenResponse = async () => json({ error: 'invalid_grant' }, 400);
});

describe('Sign in with Microsoft callback', () => {
  it('creates a new user + identity on first login, with PKCE', async () => {
    const { cookie, state, nonce, challenge } = await startLogin();
    const token = await idToken({ nonce, oid: `oid-new-${run}`, email: email('new') });
    tokenResponse = async () => json({ id_token: token });

    const { id } = tokenFrom(await callback(`code=the-code&state=${state}`, cookie));

    // PKCE: the verifier sent to the token endpoint must hash to the challenge sent to /authorize
    assert.equal(lastTokenRequest.get('code'), 'the-code');
    assert.equal(createHash('sha256').update(lastTokenRequest.get('code_verifier')!).digest('base64url'), challenge);

    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { identities: true } });
    assert.equal(user.email, email('new'));
    assert.equal(user.passwordHash, null);
    assert.deepEqual(
      user.identities.map((i) => [i.provider, i.providerUid]),
      [['microsoft', `oid-new-${run}`]],
    );
  });

  it('logs a returning user in by oid, even if their Microsoft email changed', async () => {
    const first = tokenFrom(await login({ oid: `oid-ret-${run}`, email: email('ret') }));
    const second = tokenFrom(await login({ oid: `oid-ret-${run}`, email: email('ret-renamed') }));
    assert.equal(second.id, first.id);
    assert.equal(await prisma.user.count({ where: { email: email('ret-renamed') } }), 0);
  });

  it('refuses to auto-link when a password account already has that email', async () => {
    await prisma.user.create({
      data: {
        email: email('taken'),
        username: `taken_${run}`,
        displayName: 'Existing',
        passwordHash: await bcrypt.hash('pw', 4),
      },
    });
    const location = await login({ oid: `oid-taken-${run}`, email: email('TAKEN') }); // case-insensitive match
    assert.equal(location, 'http://localhost:3000/login?error=microsoft_account_exists');
    assert.equal(await prisma.userIdentity.count({ where: { providerUid: `oid-taken-${run}` } }), 0);
  });

  it('links Microsoft after the user proves the existing account with its password', async () => {
    const pwLogin = (who: string, cookie: string) =>
      app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: email(who), password: 'pw' }, headers: { cookie } });
    for (const who of ['owner', 'other']) {
      await prisma.user.create({
        data: { email: email(who), username: `${who}_${run}`, displayName: who, passwordHash: await bcrypt.hash('pw', 4) },
      });
    }

    // Microsoft sign-in collides with "owner" → no link yet, but a link cookie is set
    const { cookie, state, nonce } = await startLogin();
    const token = await idToken({ nonce, oid: `oid-link-${run}`, email: email('owner') });
    tokenResponse = async () => json({ id_token: token });
    const res = await app.inject({ method: 'GET', url: `/api/auth/microsoft/callback?code=abc&state=${state}`, headers: { cookie } });
    assert.equal(res.headers.location, 'http://localhost:3000/login?error=microsoft_account_exists');
    const linkCookie = ([] as string[]).concat(res.headers['set-cookie'] as string[])
      .find((c) => c.startsWith('orbit_ms_link='))!.split(';')[0];

    // Logging in to a *different* account with that cookie must not link
    assert.equal((await pwLogin('other', linkCookie)).statusCode, 200);
    assert.equal(await prisma.userIdentity.count({ where: { providerUid: `oid-link-${run}` } }), 0);

    // Logging in to the matching account links it; a forged cookie is ignored
    assert.equal((await pwLogin('owner', 'orbit_ms_link=forged.sig')).statusCode, 200);
    assert.equal(await prisma.userIdentity.count({ where: { providerUid: `oid-link-${run}` } }), 0);
    const ok = await pwLogin('owner', linkCookie);
    assert.equal(ok.statusCode, 200);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: email('owner') } });
    assert.equal((await prisma.userIdentity.findFirstOrThrow({ where: { providerUid: `oid-link-${run}` } })).userId, owner.id);

    // From now on Microsoft sign-in logs straight into the existing account
    assert.equal(tokenFrom(await login({ oid: `oid-link-${run}`, email: email('owner') })).id, owner.id);
  });

  it('rejects a mismatched or missing state', async () => {
    const { cookie } = await startLogin();
    assert.equal(await callback('code=abc&state=forged', cookie), 'http://localhost:3000/login?error=microsoft_invalid_state');
    const { state } = await startLogin();
    assert.equal(await callback(`code=abc&state=${state}`), 'http://localhost:3000/login?error=microsoft_invalid_state');
  });

  it('rejects ID tokens with a wrong nonce or a token exchange failure', async () => {
    assert.equal(await login({ oid: `oid-x-${run}`, email: email('x'), nonce: 'wrong' }), 'http://localhost:3000/login?error=microsoft_failed');
    const { cookie, state } = await startLogin();
    // beforeEach default: token endpoint returns 400 invalid_grant
    assert.equal(await callback(`code=abc&state=${state}`, cookie), 'http://localhost:3000/login?error=microsoft_failed');
  });

  it('maps a denied consent to a friendly error', async () => {
    assert.equal(
      await callback('error=access_denied&error_description=user+cancelled'),
      'http://localhost:3000/login?error=microsoft_cancelled',
    );
  });

  it('blocks password login for Microsoft-only accounts', async () => {
    await login({ oid: `oid-pw-${run}`, email: email('pw') });
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: email('pw'), password: 'anything' } });
    assert.equal(res.statusCode, 401);
  });
});
