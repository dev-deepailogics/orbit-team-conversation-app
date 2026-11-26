import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@orbit/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { isDemoEmail } from '../services/demoWorkspace.js';
import { audit } from '../services/audit.js';
import { clearFileSessionCookie, fileSessionCookie } from '../services/fileAccess.js';
import { ACCESS_TOKEN_TTL, issueRefreshToken, revokeAllForUser, revokeByToken, rotateRefreshToken } from '../services/tokens.js';
import {
  createAuthorizeRequest,
  exchangeCodeForProfile,
  getMicrosoftConfig,
  openCookie,
  PendingLogin,
  sealCookie,
} from '../services/microsoftAuth.js';

const MS_COOKIE = 'orbit_ms_oauth';
// Set when a Microsoft sign-in hits an existing email; a password login in the same browser then links it.
const MS_LINK_COOKIE = 'orbit_ms_link';
type PendingLink = { providerUid: string; email: string };

const cookie = (name: string, path: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax` +
  (process.env.NODE_ENV === 'production' ? '; Secure' : '');
const msCookie = (value: string, maxAge: number) => cookie(MS_COOKIE, '/api/auth/microsoft', value, maxAge);
const linkCookie = (value: string, maxAge: number) => cookie(MS_LINK_COOKIE, '/api/auth/login', value, maxAge);

const readCookie = (header: string | undefined, name: string) =>
  header
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

// Production switch: when true, only enterprise single sign-on (Microsoft Entra ID) is accepted; email/password sign-in and
// self-registration are refused. Off by default so local and demo setups keep working.
const localAuthDisabled = () => process.env.DISABLE_LOCAL_AUTH === 'true';
const LOCAL_AUTH_DISABLED_MESSAGE = 'Password sign-in is disabled. Sign in with your organisation account.';

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:3000';
// The web login page maps these codes to friendly messages.
const loginError = (code: string) => `${clientUrl()}/login?error=${code}`;

async function uniqueUsername(email: string) {
  const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') || 'user').slice(0, 24).padEnd(3, '0');
  for (let candidate = base; ; candidate = `${base}-${randomBytes(2).toString('hex')}`) {
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Only our own uploads or DiceBear presets — no arbitrary third-party URLs (tracking pixels etc.).
const avatarUrlSchema = z
  .string()
  .max(500)
  .refine((u) => u.startsWith('/api/files/download/') || u.startsWith('/api/avatar/'), 'Invalid avatar URL');

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -').optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// JWT claims. `provider` is set when the session came from an external identity (e.g. Microsoft).
type SessionUser = { id: string; provider?: string };

type DbUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
// No password option for provider sessions, provider-only accounts, or demo accounts (they share one generated password).
const publicUser = (user: DbUser, provider?: string) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  systemRole: user.systemRole,
  status: user.status,
  customStatusText: user.customStatusText,
  customStatusEmoji: user.customStatusEmoji,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  canChangePassword: !!user.passwordHash && !provider && !isDemoEmail(user.email),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Short-lived access JWT. The username is in the claims, so it is re-signed whenever it changes.
  const signAccessToken = (user: DbUser, provider?: string | null) =>
    fastify.jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        systemRole: user.systemRole,
        ...(provider && { provider }), // keep the session's sign-in method
      },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

  // New session = access token + a fresh refresh-token family.
  const startSession = async (user: DbUser, provider?: string | null) => ({
    accessToken: signAccessToken(user, provider),
    refreshToken: await issueRefreshToken(user.id, provider),
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    if (localAuthDisabled()) return reply.status(403).send({ error: LOCAL_AUTH_DISABLED_MESSAGE });
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { email, password, username, displayName } = parseResult.data;

    // *.demo addresses are reserved for admin-generated demo workspaces.
    if (isDemoEmail(email)) {
      return reply.status(400).send({ error: 'This email domain is reserved' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return reply.status(409).send({ error: 'User with this email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        avatarUrl: `/api/avatar/bottts/svg?seed=${username}`,
      },
    });

    reply.header('set-cookie', fileSessionCookie(user.id));
    audit(request, { action: 'auth.register', actorId: user.id, actorLabel: user.email, targetType: 'user', targetId: user.id });
    return reply.status(201).send({ ...(await startSession(user)), user: publicUser(user) });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    if (localAuthDisabled()) return reply.status(403).send({ error: LOCAL_AUTH_DISABLED_MESSAGE });
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // No passwordHash = Microsoft-only account; it can't sign in with a password.
    if (!user || !user.passwordHash) {
      audit(request, { action: 'auth.login', outcome: 'failure', actorId: user?.id, actorLabel: email, metadata: { reason: user ? 'no_password' : 'unknown_user' } });
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      audit(request, { action: 'auth.login', outcome: 'failure', actorId: user.id, actorLabel: email, metadata: { reason: 'bad_password' } });
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    if (user.disabled) {
      audit(request, { action: 'auth.login', outcome: 'failure', actorId: user.id, actorLabel: email, metadata: { reason: 'account_disabled' } });
      return reply.status(403).send({ error: 'Account is deactivated' });
    }

    // Password proven: finish a pending Microsoft link from this browser (see /microsoft/callback).
    // Only links to the account whose email the Microsoft sign-in collided with.
    const msConfig = getMicrosoftConfig();
    const link = msConfig && openCookie<PendingLink>(msConfig, 'link', readCookie(request.headers.cookie, MS_LINK_COOKIE));
    if (link) {
      reply.header('set-cookie', linkCookie('', 0));
      if (link.email.toLowerCase() === user.email.toLowerCase()) {
        await prisma.userIdentity.createMany({
          data: [{ userId: user.id, provider: 'microsoft', providerUid: link.providerUid, email: link.email }],
          skipDuplicates: true, // already linked (e.g. double submit) — nothing to do
        });
      }
    }

    reply.header('set-cookie', fileSessionCookie(user.id));
    audit(request, { action: 'auth.login', actorId: user.id, actorLabel: user.email, metadata: { method: 'password' } });
    return reply.send({ ...(await startSession(user)), user: publicUser(user) });
  });

  // Sign in with Microsoft: redirect to the Entra ID authorize endpoint
  fastify.get('/microsoft', async (request, reply) => {
    const config = getMicrosoftConfig();
    if (!config) return reply.redirect(loginError('microsoft_not_configured'));

    const { url, ...pending } = createAuthorizeRequest(config);
    reply.header('set-cookie', msCookie(sealCookie(config, 'login', pending), 600));
    return reply.redirect(url);
  });

  // Sign in with Microsoft: callback. logLevel 'warn' keeps the auth code (query string) out of request logs.
  fastify.get('/microsoft/callback', { logLevel: 'warn' }, async (request, reply) => {
    reply.header('set-cookie', msCookie('', 0));
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.redirect(loginError(query.error === 'access_denied' ? 'microsoft_cancelled' : 'microsoft_failed'));
    }

    const config = getMicrosoftConfig();
    if (!config) return reply.redirect(loginError('microsoft_not_configured'));

    const pending = openCookie<PendingLogin>(config, 'login', readCookie(request.headers.cookie, MS_COOKIE));
    if (!pending || !query.code || query.state !== pending.state) {
      audit(request, { action: 'auth.login', outcome: 'failure', metadata: { method: 'microsoft', reason: 'invalid_state' } });
      return reply.redirect(loginError('microsoft_invalid_state'));
    }

    let profile;
    try {
      profile = await exchangeCodeForProfile(config, query.code, pending.codeVerifier, pending.nonce);
    } catch (err) {
      request.log.warn({ reason: (err as Error).message }, 'Microsoft sign-in failed');
      audit(request, { action: 'auth.login', outcome: 'failure', metadata: { method: 'microsoft', reason: 'token_exchange_failed' } });
      return reply.redirect(loginError('microsoft_failed'));
    }

    // Identify by the stable oid/sub only — never link by email.
    const identity = await prisma.userIdentity.findUnique({
      where: { provider_providerUid: { provider: 'microsoft', providerUid: profile.providerUid } },
      include: { user: true },
    });
    let user = identity?.user;

    if (!user) {
      const email = profile.email;
      if (!email || isDemoEmail(email)) return reply.redirect(loginError('microsoft_no_email'));

      const existing = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        // Don't link by email. Remember this identity (browser-bound, 10 min); the user must prove
        // ownership of the existing account with its password, and the login route links it then.
        const link: PendingLink = { providerUid: profile.providerUid, email };
        reply.header('set-cookie', linkCookie(sealCookie(config, 'link', link), 600));
        audit(request, { action: 'auth.login', outcome: 'failure', actorLabel: email, metadata: { method: 'microsoft', reason: 'account_exists_unlinked' } });
        return reply.redirect(loginError('microsoft_account_exists'));
      }

      try {
        const username = await uniqueUsername(email);
        user = await prisma.user.create({
          data: {
            email,
            username,
            displayName: (profile.name || username).slice(0, 50),
            avatarUrl: `/api/avatar/bottts/svg?seed=${username}`,
            identities: { create: { provider: 'microsoft', providerUid: profile.providerUid, email } },
          },
        });
      } catch (err) {
        // e.g. a concurrent callback for the same user won the unique constraint
        request.log.warn({ reason: (err as Error).message }, 'Microsoft sign-in: user creation failed');
        audit(request, { action: 'auth.login', outcome: 'failure', metadata: { method: 'microsoft', reason: 'user_creation_failed' } });
        return reply.redirect(loginError('microsoft_failed'));
      }
    }

    if (user.disabled) {
      audit(request, { action: 'auth.login', outcome: 'failure', actorId: user.id, actorLabel: user.email, metadata: { method: 'microsoft', reason: 'account_disabled' } });
      return reply.redirect(loginError('account_deactivated'));
    }

    const session = await startSession(user, 'microsoft');
    reply.header('set-cookie', fileSessionCookie(user.id));
    audit(request, { action: 'auth.login', actorId: user.id, actorLabel: user.email, metadata: { method: 'microsoft' } });
    // URL fragment: never sent to any server or logged; the login page stores it and strips it.
    return reply.redirect(
      `${clientUrl()}/login#token=${encodeURIComponent(session.accessToken)}&refreshToken=${encodeURIComponent(session.refreshToken)}`,
    );
  });

  // Swap a refresh token for a new access token + rotated refresh token.
  fastify.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'refreshToken is required' });

    const rotated = await rotateRefreshToken(parsed.data.refreshToken);
    if (!rotated.ok) return reply.status(401).send({ error: 'Invalid or expired refresh token' });

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    if (user.disabled) {
      await revokeAllForUser(user.id);
      audit(request, { action: 'auth.refresh', outcome: 'failure', actorId: user.id, actorLabel: user.email, metadata: { reason: 'account_disabled' } });
      return reply.status(403).send({ error: 'Account is deactivated' });
    }

    reply.header('set-cookie', fileSessionCookie(user.id));
    return reply.send({
      accessToken: signAccessToken(user, rotated.provider),
      refreshToken: rotated.refreshToken,
      user: publicUser(user, rotated.provider ?? undefined),
    });
  });

  // Revoke this session's refresh token family. Always succeeds so clients can log out while offline-ish.
  fastify.post('/logout', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    const loggedOutUserId = parsed.success ? await revokeByToken(parsed.data.refreshToken).catch(() => null) : null;
    if (loggedOutUserId) audit(request, { action: 'auth.logout', actorId: loggedOutUserId });
    reply.header('set-cookie', clearFileSessionCookie());
    return reply.send({ success: true });
  });

  // Get current user profile
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as SessionUser;
    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(publicUser(user, userPayload.provider));
  });

  // Update own profile (display name, username, avatar). Returns a fresh token since the JWT carries username.
  fastify.patch('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, provider } = request.user as SessionUser;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { username } = parsed.data;
    if (username) {
      const taken = await prisma.user.findFirst({ where: { username, NOT: { id } }, select: { id: true } });
      if (taken) return reply.status(409).send({ error: 'Username is already taken' });
    }

    const user = await prisma.user.update({ where: { id }, data: parsed.data });
    return reply.send({ accessToken: signAccessToken(user, provider), user: publicUser(user, provider) });
  });

  // Change own password. Not available to provider (Microsoft) sessions, accounts without a password, or demo accounts.
  fastify.post('/me/password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, provider } = request.user as SessionUser;
    if (provider) {
      return reply.status(403).send({ error: 'Your password is managed by your sign-in provider' });
    }
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true, email: true } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (isDemoEmail(user.email)) {
      return reply.status(403).send({ error: 'Demo accounts cannot change their password' });
    }

    const { currentPassword, newPassword } = parsed.data;
    if (!user.passwordHash) {
      return reply.status(403).send({ error: 'Your password is managed by your sign-in provider' });
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      audit(request, { action: 'auth.password_change', outcome: 'failure', actorId: id, targetType: 'user', targetId: id, metadata: { reason: 'wrong_current_password' } });
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }

    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    audit(request, { action: 'auth.password_change', actorId: id, targetType: 'user', targetId: id });
    // Sign out every other device, then hand this one a fresh session.
    await revokeAllForUser(id);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id } });
    reply.header('set-cookie', fileSessionCookie(fresh.id));
    return reply.send({ success: true, ...(await startSession(fresh)) });
  });
};
