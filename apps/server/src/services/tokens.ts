import { createHash, randomBytes, randomUUID } from 'crypto';
import { prisma } from '@orbit/db';
import { audit } from './audit.js';

// Short-lived access JWT + long-lived, rotating, server-side refresh token.
export const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_DAYS = Math.max(1, parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10) || 30);
// A just-rotated token presented again within this window is a benign race (two tabs refreshing at once),
// not theft: reject it without revoking the whole family.
const REUSE_GRACE_MS = 15_000;

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function issueRefreshToken(userId: string, provider?: string | null, familyId: string = randomUUID()) {
  const raw = randomBytes(48).toString('base64url');
  const now = new Date();
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      provider: provider ?? null,
      tokenHash: hash(raw),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  // Opportunistic cleanup keeps the table small without a separate job.
  prisma.refreshToken
    .deleteMany({ where: { userId, expiresAt: { lt: now } } })
    .catch(() => {});
  return raw;
}

export type RotateResult =
  | { ok: true; userId: string; provider: string | null; refreshToken: string }
  | { ok: false };

/** Validates a refresh token and swaps it for a new one in the same family. */
export async function rotateRefreshToken(raw: string): Promise<RotateResult> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row || row.expiresAt <= new Date()) return { ok: false };

  if (row.revokedAt) {
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
      // An old token came back: assume it leaked and kill every session derived from it.
      await revokeFamily(row.familyId);
      audit(null, { action: 'auth.refresh_token_reuse', outcome: 'failure', actorId: row.userId, metadata: { familyId: row.familyId } });
    }
    return { ok: false };
  }

  // Atomic claim: only one concurrent request can flip revokedAt from null.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false };

  const refreshToken = await issueRefreshToken(row.userId, row.provider, row.familyId);
  return { ok: true, userId: row.userId, provider: row.provider, refreshToken };
}

export async function revokeFamily(familyId: string) {
  await prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Logout: revoke the session (family) a refresh token belongs to. Unknown tokens are ignored. */
export async function revokeByToken(raw: string): Promise<string | null> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) }, select: { familyId: true, userId: true } });
  if (row) await revokeFamily(row.familyId);
  return row?.userId ?? null;
}

/** Password change/reset, deactivation: sign the user out everywhere. */
export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
