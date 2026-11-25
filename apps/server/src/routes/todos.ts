import { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';

const MAX_TEXT = 500;
const MAX_OPEN = 200;
// The web app's in-app message link: message://<channelId>/<messageId>[/<parentMessageId>]
const MESSAGE_LINK = /^message:\/\/[\w-]+\/[\w-]+(?:\/[\w-]+)?$/;

// Personal quick to-dos: every route is scoped to the signed-in user.
export async function todoRoutes(fastify: FastifyInstance) {
  const uid = (request: any) => (request.user as { id: string }).id;

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    return prisma.todo.findMany({
      where: { userId: uid(request) },
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = uid(request);
    const body = (request.body ?? {}) as { text?: string; messageLink?: string };
    const text = String(body.text ?? '').trim();
    if (!text) return reply.status(400).send({ error: 'text is required' });
    if (text.length > MAX_TEXT) return reply.status(400).send({ error: `text must be at most ${MAX_TEXT} characters` });
    const messageLink = body.messageLink || null;
    if (messageLink && !MESSAGE_LINK.test(messageLink)) return reply.status(400).send({ error: 'Invalid messageLink' });
    if ((await prisma.todo.count({ where: { userId, done: false } })) >= MAX_OPEN) {
      return reply.status(400).send({ error: 'Too many open to-dos. Complete or delete some first.' });
    }
    return reply.status(201).send(await prisma.todo.create({ data: { userId, text, messageLink } }));
  });

  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { text?: string; done?: boolean };
    const data: { text?: string; done?: boolean; doneAt?: Date | null } = {};
    if (body.text !== undefined) {
      const text = String(body.text).trim();
      if (!text || text.length > MAX_TEXT) return reply.status(400).send({ error: 'Invalid text' });
      data.text = text;
    }
    if (body.done !== undefined) {
      data.done = !!body.done;
      data.doneAt = body.done ? new Date() : null;
    }
    const res = await prisma.todo.updateMany({ where: { id, userId }, data });
    if (res.count === 0) return reply.status(404).send({ error: 'To-do not found' });
    return prisma.todo.findUnique({ where: { id } });
  });

  // Registered before /:id so "completed" is never read as an id.
  fastify.delete('/completed', { preHandler: [fastify.authenticate] }, async (request) => {
    const res = await prisma.todo.deleteMany({ where: { userId: uid(request), done: true } });
    return { deleted: res.count };
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await prisma.todo.deleteMany({ where: { id, userId: uid(request) } });
    if (res.count === 0) return reply.status(404).send({ error: 'To-do not found' });
    return reply.status(204).send();
  });
}
