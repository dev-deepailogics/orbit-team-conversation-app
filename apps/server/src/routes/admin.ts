import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const updateRoleSchema = z.object({
  systemRole: z.enum(['SUPER_ADMIN', 'WORKSPACE_ADMIN', 'USER']),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

const adminCreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  ownerEmailOrId: z.string().min(1),
  iconUrl: z.string().optional(),
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Middleware to ensure caller is SUPER_ADMIN
  const ensureSuperAdmin = async (request: any, reply: any) => {
    await fastify.authenticate(request, reply);
    const userId = request.user?.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });

    if (user?.systemRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Access denied: Super Admin privileges required.' });
    }
  };

  // 1. System Platform Overview Stats
  fastify.get('/stats', { preHandler: [ensureSuperAdmin] }, async (_request, reply) => {
    const [
      totalUsers,
      totalWorkspaces,
      totalChannels,
      totalMessages,
      totalAttachments,
      storageAggregate,
      onlineUsers,
      roleCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.channel.count(),
      prisma.message.count(),
      prisma.attachment.count(),
      prisma.attachment.aggregate({ _sum: { fileSize: true } }),
      prisma.user.count({ where: { status: 'ONLINE' } }),
      prisma.user.groupBy({
        by: ['systemRole'],
        _count: { id: true },
      }),
    ]);

    const totalStorageBytes = storageAggregate._sum.fileSize || 0;

    return reply.send({
      totalUsers,
      totalWorkspaces,
      totalChannels,
      totalMessages,
      totalAttachments,
      totalStorageBytes,
      formattedStorage: formatBytes(totalStorageBytes),
      onlineUsers,
      roles: roleCounts.reduce((acc: Record<string, number>, r) => {
        acc[r.systemRole] = r._count.id;
        return acc;
      }, {}),
    });
  });

  // 2. List All Users Across Platform
  fastify.get('/users', { preHandler: [ensureSuperAdmin] }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        systemRole: true,
        status: true,
        disabled: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            memberships: true,
            ownedWorkspaces: true,
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(users);
  });

  // 3. Update User System Role
  fastify.patch('/users/:userId/role', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const callerId = (request.user as { id: string }).id;

    const parseResult = updateRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Valid systemRole is required' });
    }

    const { systemRole } = parseResult.data;

    if (callerId === userId && systemRole !== 'SUPER_ADMIN') {
      return reply.status(400).send({ error: 'You cannot demote your own Super Admin account' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { systemRole },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        systemRole: true,
      },
    });

    return reply.send({ success: true, user: updatedUser });
  });

  // 4. Toggle User Disabled / Active Status
  fastify.patch('/users/:userId/status', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const callerId = (request.user as { id: string }).id;

    const bodySchema = z.object({
      disabled: z.boolean(),
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'disabled boolean value is required' });
    }

    const { disabled } = parseResult.data;

    if (callerId === userId && disabled) {
      return reply.status(400).send({ error: 'You cannot disable your own Super Admin account' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        disabled,
        ...(disabled ? { status: 'OFFLINE' } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        systemRole: true,
        disabled: true,
      },
    });

    if (disabled && fastify.io) {
      // Notify the deactivated user's sockets to immediately log out
      fastify.io.to(`user:${userId}`).emit('account:deactivated', {
        message: 'Your account has been deactivated by an administrator.',
      });
      // Disconnect all sockets belonging to this user
      const userSockets = await fastify.io.in(`user:${userId}`).fetchSockets();
      userSockets.forEach((s) => s.disconnect(true));
    }

    return reply.send({ success: true, user: updatedUser });
  });

  // 5. Reset User Password
  fastify.post('/users/:userId/reset-password', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const parseResult = resetPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const { newPassword } = parseResult.data;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return reply.send({ success: true, message: 'Password has been reset successfully' });
  });

  // 5. Delete User
  fastify.delete('/users/:userId', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const callerId = (request.user as { id: string }).id;

    if (callerId === userId) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return reply.send({ success: true, deletedUserId: userId });
  });

  // 6. List All Workspaces Across Platform
  fastify.get('/workspaces', { preHandler: [ensureSuperAdmin] }, async (_request, reply) => {
    const workspaces = await prisma.workspace.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            members: true,
            channels: true,
            attachments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(workspaces);
  });

  // 7. Create Workspace on behalf of User
  fastify.post('/workspaces', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const parseResult = adminCreateWorkspaceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, slug, ownerEmailOrId, iconUrl } = parseResult.data;

    const existingSlug = await prisma.workspace.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      return reply.status(409).send({ error: 'Workspace slug already taken' });
    }

    const owner = await prisma.user.findFirst({
      where: {
        OR: [{ email: ownerEmailOrId }, { username: ownerEmailOrId }, { id: ownerEmailOrId }],
      },
    });

    if (!owner) {
      return reply.status(404).send({ error: `Owner user "${ownerEmailOrId}" not found` });
    }

    // Promote owner to WORKSPACE_ADMIN if they are a regular USER
    if (owner.systemRole === 'USER') {
      await prisma.user.update({
        where: { id: owner.id },
        data: { systemRole: 'WORKSPACE_ADMIN' },
      });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        iconUrl: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${slug}`,
        ownerId: owner.id,
        members: {
          create: {
            userId: owner.id,
            role: 'OWNER',
          },
        },
        channels: {
          create: [
            {
              name: 'general',
              topic: 'Company-wide announcements and work-based matters',
              type: 'PUBLIC',
              createdById: owner.id,
              members: {
                create: { userId: owner.id },
              },
            },
            {
              name: 'random',
              topic: 'Non-work banter and water cooler chat',
              type: 'PUBLIC',
              createdById: owner.id,
              members: {
                create: { userId: owner.id },
              },
            },
          ],
        },
      },
      include: {
        owner: {
          select: { id: true, email: true, displayName: true },
        },
        _count: {
          select: { members: true, channels: true },
        },
      },
    });

    return reply.status(201).send(workspace);
  });

  // 8. Delete Workspace
  fastify.delete('/workspaces/:workspaceId', { preHandler: [ensureSuperAdmin] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return reply.send({ success: true, deletedWorkspaceId: workspaceId });
  });
};
