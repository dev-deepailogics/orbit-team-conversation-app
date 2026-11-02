import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { z } from 'zod';
import { getVapidPublicKey, pushEnabled } from '../services/pushService.js';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const deviceSchema = z.object({ token: z.string().min(1), platform: z.enum(['ios', 'android']) });

export const pushRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/public-key', async () => ({ enabled: pushEnabled, publicKey: getVapidPublicKey() }));

  fastify.post('/subscribe', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid subscription' });
    const userId = (request.user as any).id as string;
    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: request.headers['user-agent'] },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
    return { success: true };
  });

  fastify.post('/unsubscribe', { preHandler: [fastify.authenticate] }, async (request) => {
    const { endpoint } = (request.body || {}) as { endpoint?: string };
    const userId = (request.user as any).id as string;
    if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return { success: true };
  });

  // Mobile FCM token. Upsert by token so a device that switches accounts moves to the new user.
  fastify.post('/device', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = deviceSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid device token' });
    const userId = (request.user as any).id as string;
    const { token, platform } = parsed.data;
    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { success: true };
  });

  fastify.post('/device/remove', { preHandler: [fastify.authenticate] }, async (request) => {
    const { token } = (request.body || {}) as { token?: string };
    const userId = (request.user as any).id as string;
    if (token) await prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { success: true };
  });
};
