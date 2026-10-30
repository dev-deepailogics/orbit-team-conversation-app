import webpush from 'web-push';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '@orbit/db';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@orbit.local';

export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
export const getVapidPublicKey = () => VAPID_PUBLIC_KEY;

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Prod: service-account JSON (single line) from Firebase console → Project settings → Service accounts.
// Local dev: leave it unset and set FIREBASE_PROJECT_ID to use `gcloud auth application-default login` instead.
// Initialised lazily: index.ts calls dotenv.config() after its imports run, so env isn't loaded at module load.
let fcmReady = false;
function initFcm(): boolean {
  if (fcmReady) return true;
  const account = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  if (!account && !projectId) return false;
  try {
    if (getApps().length === 0) {
      initializeApp(
        account
          ? { credential: cert(JSON.parse(account)) }
          : { credential: applicationDefault(), projectId },
      );
    }
    fcmReady = true;
  } catch (err) {
    console.error('Firebase Admin init failed; mobile push disabled', err);
  }
  return fcmReady;
}

interface MobilePush {
  title: string;
  body: string;
  channelId: string;
  parentMessageId?: string;
}

async function sendToDevices(userIds: string[], push: MobilePush) {
  if (!initFcm() || userIds.length === 0) return;
  const tokens = await prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
  if (tokens.length === 0) {
    console.log('FCM push: recipients have no registered devices');
    return;
  }
  // Per-thread collapse key so replies stack under one notification, like Slack.
  const group = push.parentMessageId ? `thread:${push.parentMessageId}` : `channel:${push.channelId}`;
  // FCM data values must be strings.
  const data: Record<string, string> = { channelId: push.channelId };
  if (push.parentMessageId) data.parentMessageId = push.parentMessageId;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500).map((t) => t.token);
    const res = await getMessaging().sendEachForMulticast({
      tokens: batch,
      notification: { title: push.title, body: push.body },
      data,
      android: { priority: 'high', notification: { tag: group } },
      apns: { headers: { 'apns-collapse-id': group.slice(0, 64) }, payload: { aps: { threadId: group, sound: 'default' } } },
    });
    // One bad token never throws; surface the reason so silent failures aren't invisible.
    res.responses.forEach((r) => {
      if (r.error && r.error.code !== 'messaging/registration-token-not-registered') {
        console.warn('FCM send failed', r.error.code, r.error.message);
      }
    });
    console.log(`FCM push ${group}: ${res.successCount} sent, ${res.failureCount} failed`);
    const dead = res.responses
      .map((r, j) => (r.error?.code === 'messaging/registration-token-not-registered' ? batch[j] : null))
      .filter((t): t is string => Boolean(t));
    if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
  }
}

async function sendToUser(userId: string, payload: object) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24, urgency: 'high' }
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('Web push failed', err?.statusCode, err?.body || err?.message);
        }
      }
    })
  );
}

async function notifyMessage(io: any, messageId: string) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      user: { select: { id: true, displayName: true, username: true } },
      bot: { select: { name: true } },
      channel: { select: { id: true, name: true, type: true, isAnonymous: true, workspaceId: true } },
      attachments: { select: { id: true }, take: 1 },
    },
  });
  if (!msg || msg.isDeleted) return;
  console.log(`Push fan-out for message ${msg.id} in ${msg.channel.type} ${msg.channelId}`);

  // Thread replies only notify people in the thread (parent author + earlier repliers), like Slack.
  let participants: string[] | null = null;
  if (msg.parentMessageId) {
    const thread = await prisma.message.findMany({
      where: { OR: [{ id: msg.parentMessageId }, { parentMessageId: msg.parentMessageId }], userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    });
    participants = thread.map((t) => t.userId as string);
  }

  const members = await prisma.channelMember.findMany({
    where: {
      channelId: msg.channelId,
      ...(msg.userId ? { userId: { not: msg.userId } } : {}),
      ...(participants ? { userId: { in: participants.filter((id) => id !== msg.userId) } } : {}),
    },
    select: { userId: true },
  });
  if (members.length === 0) {
    console.log('Push fan-out: no recipients');
    return;
  }
  const memberIds = members.map((m) => m.userId);

  const isDM = msg.channel.type === 'DIRECT' || msg.channel.type === 'GROUP_DIRECT';
  const sender = msg.channel.isAnonymous
    ? 'Someone'
    : msg.user?.displayName || msg.user?.username || msg.bot?.name || 'New message';
  const title = isDM ? sender : `${sender} in #${msg.channel.name}`;
  const text = (msg.content || '').trim();
  const bodyText = text ? text.slice(0, 160) : msg.attachments.length ? 'Sent an attachment' : 'New message';

  const url = `/?channelId=${msg.channelId}`;

  // Mobile: always send. FCM doesn't show notifications while the app is foregrounded; the app draws its own banner.
  await sendToDevices(memberIds, { title, body: bodyText, channelId: msg.channelId, parentMessageId: msg.parentMessageId ?? undefined });

  // Only users that have web push subscriptions
  const subscribed = await prisma.pushSubscription.findMany({
    where: { userId: { in: memberIds } },
    select: { userId: true },
    distinct: ['userId'],
  });

  for (const { userId } of subscribed) {
    // Skip users with a live socket: they already get an in-app notification
    try {
      const live = await io.in(`user:${userId}`).fetchSockets();
      if (live.length > 0) continue;
    } catch {
      /* fall through and push */
    }
    await sendToUser(userId, {
      title,
      body: bodyText,
      url,
      tag: `channel:${msg.channelId}`,
      channelId: msg.channelId,
    });
  }
}

/** Hook every message creation (routes, bots, webhooks, system bot) to fan out web push. */
export function registerPushMiddleware(io: any) {
  if (!pushEnabled) console.warn('Web push disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  const fcmEnabled = initFcm();
  if (fcmEnabled) console.log('Mobile push (FCM) enabled');
  else console.warn('Mobile push disabled: set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID for local ADC)');
  if (!pushEnabled && !fcmEnabled) return;
  prisma.$use(async (params, next) => {
    const result = await next(params);
    if (params.model === 'Message' && params.action === 'create' && result?.id) {
      // Delay slightly so attachments created right after are visible; never block the request
      setTimeout(() => {
        notifyMessage(io, result.id).catch((e) => console.error('Push fan-out error', e));
      }, 500);
    }
    return result;
  });
}
