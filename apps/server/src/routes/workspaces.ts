import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  iconUrl: z.string().optional(),
});

const joinWorkspaceSchema = z.object({
  inviteCode: z.string().min(1),
});

export const workspaceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // List all workspaces user belongs to
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                channels: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return reply.send(memberships.map((m) => m.workspace));
  });

  // Create workspace
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const parseResult = createWorkspaceSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, slug, iconUrl } = parseResult.data;

    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug },
    });

    if (existingWorkspace) {
      return reply.status(409).send({ error: 'Workspace URL slug is already taken' });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        iconUrl: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${slug}`,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
        channels: {
          create: [
            {
              name: 'general',
              topic: 'Company-wide announcements and work-based matters',
              type: 'PUBLIC',
              createdById: userId,
              members: {
                create: {
                  userId,
                },
              },
            },
            {
              name: 'random',
              topic: 'Non-work banter and water cooler chat',
              type: 'PUBLIC',
              createdById: userId,
              members: {
                create: {
                  userId,
                },
              },
            },
          ],
        },
      },
      include: {
        channels: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return reply.status(201).send(workspace);
  });

  // Get workspace details by ID
  fastify.get('/:workspaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    // Check membership
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        channels: {
          orderBy: { createdAt: 'asc' },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
                customStatusText: true,
                customStatusEmoji: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    return reply.send(workspace);
  });

  // Join workspace using inviteCode
  fastify.post('/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const parseResult = joinWorkspaceSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invite code is required' });
    }

    const { inviteCode } = parseResult.data;

    const workspace = await prisma.workspace.findUnique({
      where: { inviteCode },
      include: {
        channels: {
          where: { type: 'PUBLIC' },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({ error: 'Invalid invite code' });
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
    });

    if (!existingMember) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'MEMBER',
        },
      });

      // Auto-join public channels
      for (const ch of workspace.channels) {
        await prisma.channelMember.upsert({
          where: {
            channelId_userId: {
              channelId: ch.id,
              userId,
            },
          },
          create: {
            channelId: ch.id,
            userId,
          },
          update: {},
        });
      }
    }

    return reply.send({ success: true, workspaceId: workspace.id });
  });
};
