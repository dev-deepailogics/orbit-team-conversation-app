import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// Sign in with Microsoft (Entra ID) — OIDC authorization code flow with PKCE.
// Env is read lazily because dotenv is loaded after imports in index.ts.

const AUTHORITY = 'https://login.microsoftonline.com';
// Tenant id of personal Microsoft accounts (outlook.com, live.com, ...).
const MSA_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

export function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, tenant: process.env.MICROSOFT_TENANT_ID || 'common' };
}

export type MicrosoftConfig = NonNullable<ReturnType<typeof getMicrosoftConfig>>;

const randomToken = () => randomBytes(32).toString('base64url');

/** Builds the authorize URL plus the values that must be remembered (in a cookie) until the callback. */
export function createAuthorizeRequest(config: MicrosoftConfig) {
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const url = new URL(`${AUTHORITY}/${config.tenant}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  return { url: url.toString(), state, nonce, codeVerifier };
}

// Short-lived cookies (pending login, pending link) are HMAC-signed with a key derived from the client
// secret — deliberately NOT fastify.jwt, whose tokens the `authenticate` decorator would accept as
// access tokens. `purpose` stops one cookie type being replayed as the other.
export type CookiePurpose = 'login' | 'link';
export type PendingLogin = { state: string; nonce: string; codeVerifier: string };
const COOKIE_TTL_MS = 10 * 60 * 1000;
const sign = (config: MicrosoftConfig, purpose: CookiePurpose, body: string) =>
  createHmac('sha256', config.clientSecret).update(`orbit-ms:${purpose}:${body}`).digest('base64url');

export function sealCookie(config: MicrosoftConfig, purpose: CookiePurpose, data: object): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + COOKIE_TTL_MS })).toString('base64url');
  return `${body}.${sign(config, purpose, body)}`;
}

export function openCookie<T>(config: MicrosoftConfig, purpose: CookiePurpose, value: string | undefined): T | null {
  const [body, sig] = (value ?? '').split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(config, purpose, body));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

const jwksByTenant =new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getJwks(tenant: string) {
  let jwks = jwksByTenant.get(tenant);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${AUTHORITY}/${tenant}/discovery/v2.0/keys`));
    jwksByTenant.set(tenant, jwks);
  }
  return jwks;
}

/**
 * The issuer is always `https://login.microsoftonline.com/{tid}/v2.0`. With "common" the
 * discovery doc only gives a `{tenantid}` template, so check iss against the token's own tid,
 * then restrict tid to what the configured tenant allows.
 */
export function isAllowedIssuer(payload: JWTPayload, tenant: string): boolean {
  const tid = payload.tid;
  if (typeof tid !== 'string' || payload.iss !== `${AUTHORITY}/${tid}/v2.0`) return false;
  switch (tenant.toLowerCase()) {
    case 'common':
      return true;
    case 'organizations':
      return tid !== MSA_TENANT_ID;
    case 'consumers':
      return tid === MSA_TENANT_ID;
    default:
      // Must be the tenant GUID. A domain name here fails closed (every login rejected).
      return tid.toLowerCase() === tenant.toLowerCase();
  }
}

export interface MicrosoftProfile {
  providerUid: string;
  email: string | null;
  name: string | null;
}

export class MicrosoftAuthError extends Error {}

/** Exchanges the code for tokens and validates the ID token (signature, iss, aud, exp, nonce). */
export async function exchangeCodeForProfile(
  config: MicrosoftConfig,
  code: string,
  codeVerifier: string,
  expectedNonce: string,
): Promise<MicrosoftProfile> {
  const res = await fetch(`${AUTHORITY}/${config.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
      scope: 'openid profile email',
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) {
    // Only the OAuth error code — never the response body, which may carry tokens.
    throw new MicrosoftAuthError(`Token exchange failed (${res.status} ${body.error ?? 'no id_token'})`);
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(body.id_token, getJwks(config.tenant), {
      audience: config.clientId,
      algorithms: ['RS256'],
      clockTolerance: 60,
    }));
  } catch (err) {
    throw new MicrosoftAuthError(`ID token verification failed: ${(err as Error).message}`);
  }
  if (!isAllowedIssuer(payload, config.tenant)) throw new MicrosoftAuthError('ID token issuer not allowed');
  if (payload.nonce !== expectedNonce) throw new MicrosoftAuthError('ID token nonce mismatch');

  // oid is the stable per-user id (requires the `profile` scope); sub is the pairwise fallback.
  const providerUid = (payload.oid as string | undefined) ?? payload.sub;
  if (!providerUid) throw new MicrosoftAuthError('ID token has no oid/sub');

  const preferred = payload.preferred_username as string | undefined;
  const email = (payload.email as string | undefined) ?? (preferred?.includes('@') ? preferred : null);
  return { providerUid, email: email ?? null, name: (payload.name as string | undefined) ?? null };
}
