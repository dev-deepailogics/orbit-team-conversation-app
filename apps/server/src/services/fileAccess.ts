import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@orbit/db';
import { canUserAccessChannel, canUserAccessWorkspace } from '../utils/security.js';
import { INTERNAL_FILE_PREFIX } from './attachments.js';

/**
 * Browsers load <img>, <video> and download links without an Authorization header, so file reads accept a second,
 * narrower credential: an HttpOnly "file session" cookie. It is issued next to the access token at sign-in and on
 * every refresh, is signed with a key derived from JWT_SECRET (so it can never be used as an API access token) and only
 * identifies the user. Every file read still re-checks that the account is active and has access to the file.
 */
const FILE_COOKIE = 'orbit_fs';
const FILE_COOKIE_TTL_S = 8 * 60 * 60;

let signingKey = '';

/** Called once at startup with the resolved JWT secret. */
export function initFileSession(jwtSecret: string) {
  signingKey = createHmac('sha256', jwtSecret).update('orbit-file-session-v1').digest('hex');
}

const sign = (body: string) => createHmac('sha256', signingKey).update(body).digest('base64url');

function sealFileSession(userId: string): string {
  const body = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + FILE_COOKIE_TTL_S * 1000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function openFileSession(value: string | undefined): string | null {
  if (!signingKey) return null;
  const [body, sig] = (value ?? '').split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof data.id === 'string' && data.exp > Date.now() ? data.id : null;
  } catch {
    return null;
  }
}

const cookieAttrs = (maxAge: number) =>
  `Path=/api; Max-Age=${maxAge}; HttpOnly; SameSite=Lax` + (process.env.NODE_ENV === 'production' ? '; Secure' : '');

/** Set-Cookie value that (re)issues the file session for a signed-in user. */
export const fileSessionCookie = (userId: string) => `${FILE_COOKIE}=${sealFileSession(userId)}; ${cookieAttrs(FILE_COOKIE_TTL_S)}`;
/** Set-Cookie value that removes it (logout). */
export const clearFileSessionCookie = () => `${FILE_COOKIE}=; ${cookieAttrs(0)}`;

const readCookie = (header: string | undefined, name: string) =>
  header
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

/**
 * The signed-in, active user behind a file or media request: a Bearer access token (apps, API clients) or the file
 * session cookie (browsers). Returns null for anonymous, expired, invalid or deactivated callers.
 */
export async function resolveRequesterId(fastify: FastifyInstance, request: FastifyRequest): Promise<string | null> {
  let userId: string | null = null;

  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = fastify.jwt.verify<{ id?: string }>(auth.slice(7));
      userId = payload?.id ?? null;
    } catch {
      return null;
    }
  } else {
    userId = openFileSession(readCookie(request.headers.cookie, FILE_COOKIE));
  }
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, disabled: true } });
  return user && !user.disabled ? user.id : null;
}

/**
 * May this user read this stored file? The uploader and super admins always; otherwise anyone with access to the
 * channel the file was shared in (or the workspace, for files not tied to a channel). Profile and bot pictures are
 * readable by every signed-in user.
 */
export async function canReadAttachment(
  userId: string,
  attachment: { id: string; fileUrl: string; workspaceId: string; channelId: string | null; uploaderId: string | null },
): Promise<boolean> {
  if (attachment.uploaderId === userId) return true;

  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  if (caller?.systemRole === 'SUPER_ADMIN') return true;

  if (attachment.channelId) {
    if (await canUserAccessChannel(userId, attachment.channelId)) return true;
  } else if (await canUserAccessWorkspace(userId, attachment.workspaceId)) {
    return true;
  }

  const [userPicture, botPicture] = await Promise.all([
    prisma.user.findFirst({ where: { avatarUrl: attachment.fileUrl }, select: { id: true } }),
    prisma.botApp.findFirst({ where: { avatarUrl: attachment.fileUrl }, select: { id: true } }),
  ]);
  return !!(userPicture || botPicture);
}

/**
 * Files stored before uploads were recorded in the database (profile pictures, document and ticket images) have no
 * record to check. The storage path names the workspace they were uploaded to, so members of that workspace may read
 * them; a picture that someone uses as their profile or bot image is readable by any signed-in user.
 */
export async function canReadUntrackedFile(userId: string, fileKey: string): Promise<boolean> {
  if (fileKey.split('/').includes('..')) return false;
  const workspace = /^workspaces\/([^/]+)\//.exec(fileKey);
  if (workspace && (await canUserAccessWorkspace(userId, workspace[1]))) return true;

  const url = INTERNAL_FILE_PREFIX + fileKey;
  const [userPicture, botPicture] = await Promise.all([
    prisma.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    prisma.botApp.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
  ]);
  return !!(userPicture || botPicture);
}

/**
 * A recording's video or thumbnail: readable without signing in, since the recording's share link is public by design.
 * Looked up by storage key because a thumbnail is stored without an attachment record of its own.
 */
export async function isSharedRecordingKey(fileKey: string): Promise<boolean> {
  const recording = await prisma.recording.findFirst({
    where: {
      isDeleted: false,
      OR: [{ attachment: { fileKey } }, { thumbnailUrl: INTERNAL_FILE_PREFIX + fileKey }],
    },
    select: { id: true },
  });
  return !!recording;
}
