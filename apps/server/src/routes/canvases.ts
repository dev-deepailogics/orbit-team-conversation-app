import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@orbit/db';
import {
  canUserAccessCanvas,
  canUserAccessChannel,
  verifyWorkspaceMember,
} from '../utils/security.js';

// List payload omits the (potentially large) drawing data.
const LIST_SELECT = {
  id: true,
  workspaceId: true,
  title: true,
  channelId: true,
  projectId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function loadCanvas(userId: string, id: string, reply: FastifyReply) {
  const canvas = await prisma.canvas.findUnique({ where: { id } });
  if (!canvas) {
    reply.status(404).send({ error: 'Canvas not found' });
    return null;
  }
  if (!(await canUserAccessCanvas(userId, canvas))) {
    reply.status(403).send({ error: 'You do not have access to this canvas' });
    return null;
  }
  return canvas;
}

// Validates a channel/project link target belongs to the workspace and is accessible.
async function checkLinkTarget(
  userId: string,
  workspaceId: string,
  link: { channelId?: string | null; projectId?: string | null },
  reply: FastifyReply
): Promise<boolean> {
  if (link.channelId) {
    const ch = await prisma.channel.findUnique({ where: { id: link.channelId }, select: { workspaceId: true } });
    if (!ch || ch.workspaceId !== workspaceId || !(await canUserAccessChannel(userId, link.channelId))) {
      reply.status(400).send({ error: 'Invalid channel' });
      return false;
    }
  }
  if (link.projectId) {
    const pr = await prisma.project.findUnique({ where: { id: link.projectId }, select: { workspaceId: true } });
    if (!pr || pr.workspaceId !== workspaceId) {
      reply.status(400).send({ error: 'Invalid project' });
      return false;
    }
  }
  return true;
}

export async function canvasRoutes(fastify: FastifyInstance) {
  // List canvases in a workspace, optionally only those linked to a channel or project
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { workspaceId, channelId, projectId } = request.query as {
      workspaceId?: string;
      channelId?: string;
      projectId?: string;
    };
    if (!workspaceId) return reply.status(400).send({ error: 'workspaceId is required' });

    const access = await verifyWorkspaceMember(userId, workspaceId, reply);
    if (!access) return;

    return prisma.canvas.findMany({
      where: {
        workspaceId,
        ...(channelId && { channelId }),
        ...(projectId && { projectId }),
        // Hide canvases linked to private channels / DMs the user isn't in
        ...(!access.isSuperAdmin && {
          OR: [
            { channelId: null },
            { channel: { type: 'PUBLIC' } },
            { channel: { members: { some: { userId } } } },
          ],
        }),
      },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { workspaceId, title, channelId, projectId } = request.body as {
      workspaceId?: string;
      title?: string;
      channelId?: string | null;
      projectId?: string | null;
    };
    if (!workspaceId) return reply.status(400).send({ error: 'workspaceId is required' });

    if (!(await verifyWorkspaceMember(userId, workspaceId, reply))) return;
    if (!(await checkLinkTarget(userId, workspaceId, { channelId, projectId }, reply))) return;

    const canvas = await prisma.canvas.create({
      data: {
        workspaceId,
        title: title?.trim() || 'Untitled canvas',
        channelId: channelId || null,
        projectId: channelId ? null : projectId || null,
        createdById: userId,
        data: { elements: [] },
      },
      select: LIST_SELECT,
    });
    return reply.status(201).send(canvas);
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const canvas = await loadCanvas(userId, (request.params as { id: string }).id, reply);
    if (!canvas) return;
    return { ...canvas, data: canvas.data || { elements: [] } };
  });

  // Rename and/or link. A canvas links to at most one target: setting one clears the other.
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const canvas = await loadCanvas(userId, (request.params as { id: string }).id, reply);
    if (!canvas) return;

    const body = request.body as { title?: string; channelId?: string | null; projectId?: string | null };
    const data: { title?: string; channelId?: string | null; projectId?: string | null } = {};
    if (typeof body.title === 'string') data.title = body.title.trim() || 'Untitled canvas';
    if ('channelId' in body || 'projectId' in body) {
      if (!(await checkLinkTarget(userId, canvas.workspaceId, body, reply))) return;
      data.channelId = body.channelId || null;
      data.projectId = body.channelId ? null : body.projectId || null;
    }

    return prisma.canvas.update({ where: { id: canvas.id }, data, select: LIST_SELECT });
  });

  // Save drawing data (live sync goes over sockets; this just persists)
  fastify.put('/:id/data', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const canvas = await loadCanvas(userId, (request.params as { id: string }).id, reply);
    if (!canvas) return;

    const { data } = request.body as { data?: { elements?: unknown[] } };
    if (!Array.isArray(data?.elements)) return reply.status(400).send({ error: 'data.elements must be an array' });

    await prisma.canvas.update({ where: { id: canvas.id }, data: { data: { elements: data.elements as any } } });
    return { success: true };
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const canvas = await loadCanvas(userId, (request.params as { id: string }).id, reply);
    if (!canvas) return;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    if (canvas.createdById !== userId && user?.systemRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Only the creator can delete this canvas' });
    }

    await prisma.canvas.delete({ where: { id: canvas.id } });
    return { success: true };
  });
}
