import webpush from 'web-push';
import { prisma } from '@orbit/db';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@orbit.local';

export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
export const getVapidPublicKey = () => VAPID_PUBLIC_KEY;

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

  const members = await prisma.channelMember.findMany({
    where: { channelId: msg.channelId, ...(msg.userId ? { userId: { not: msg.userId } } : {}) },
    select: { userId: true },
  });
  if (members.length === 0) return;

  // Only users that have push subscriptions
  const subscribed = await prisma.pushSubscription.findMany({
    where: { userId: { in: members.map((m) => m.userId) } },
    select: { userId: true },
    distinct: ['userId'],
  });

  const isDM = msg.channel.type === 'DIRECT' || msg.channel.type === 'GROUP_DIRECT';
  const sender = msg.channel.isAnonymous
    ? 'Someone'
    : msg.user?.displayName || msg.user?.username || msg.bot?.name || 'New message';
  const title = isDM ? sender : `${sender} in #${msg.channel.name}`;
  const text = (msg.content || '').trim();
  const bodyText = text ? text.slice(0, 160) : msg.attachments.length ? 'Sent an attachment' : 'New message';

  const url = `/?channelId=${msg.channelId}`;

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
  if (!pushEnabled) {
    console.warn('Web push disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    return;
  }
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
