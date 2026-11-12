import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@orbit/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { isDemoEmail } from '../services/demoWorkspace.js';
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
  .refine((u) => u.startsWith('/api/files/download/') || u.startsWith('https://api.dicebear.com/'), 'Invalid avatar URL');

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

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register
  fastify.post('/register', async (request, reply) => {
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
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      },
    });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      username: user.username,
      systemRole: user.systemRole,
    });

    return reply.status(201).send({ accessToken: token, user: publicUser(user) });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
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
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    if (user.disabled) {
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

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      username: user.username,
      systemRole: user.systemRole,
    });

    return reply.send({ accessToken: token, user: publicUser(user) });
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
      return reply.redirect(loginError('microsoft_invalid_state'));
    }

    let profile;
    try {
      profile = await exchangeCodeForProfile(config, query.code, pending.codeVerifier, pending.nonce);
    } catch (err) {
      request.log.warn({ reason: (err as Error).message }, 'Microsoft sign-in failed');
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
        return reply.redirect(loginError('microsoft_account_exists'));
      }

      try {
        const username = await uniqueUsername(email);
        user = await prisma.user.create({
          data: {
            email,
            username,
            displayName: (profile.name || username).slice(0, 50),
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            identities: { create: { provider: 'microsoft', providerUid: profile.providerUid, email } },
          },
        });
      } catch (err) {
        // e.g. a concurrent callback for the same user won the unique constraint
        request.log.warn({ reason: (err as Error).message }, 'Microsoft sign-in: user creation failed');
        return reply.redirect(loginError('microsoft_failed'));
      }
    }

    if (user.disabled) return reply.redirect(loginError('account_deactivated'));

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      username: user.username,
      systemRole: user.systemRole,
      provider: 'microsoft',
    });
    // URL fragment: never sent to any server or logged; the login page stores it and strips it.
    return reply.redirect(`${clientUrl()}/login#token=${encodeURIComponent(token)}`);
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
    const accessToken = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      username: user.username,
      systemRole: user.systemRole,
      ...(provider && { provider }), // keep the session's sign-in method
    });
    return reply.send({ accessToken, user: publicUser(user, provider) });
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
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }

    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    return reply.send({ success: true });
  });
};
