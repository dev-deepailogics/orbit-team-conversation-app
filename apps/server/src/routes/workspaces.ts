import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { z } from 'zod';
import { ACTIVITY_CHANNEL, ACTIVITY_CHANNEL_TOPIC, sendSystemNotification } from '../services/systemBot.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  iconUrl: z.string().optional(),
});

const joinWorkspaceSchema = z.object({
  inviteCode: z.string().min(1),
});

const addWorkspaceMemberSchema = z.object({
  emailOrUsername: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
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

    // Check user system role
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });

    if (caller?.systemRole !== 'SUPER_ADMIN' && caller?.systemRole !== 'WORKSPACE_ADMIN') {
      return reply.status(403).send({
        error: 'Only workspace administrators or super admins can create workspaces. Please contact the administrator.',
      });
    }

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
            {
              name: ACTIVITY_CHANNEL,
              topic: ACTIVITY_CHANNEL_TOPIC,
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
          where: {
            OR: [
              { type: 'PUBLIC' },
              { members: { some: { userId } } },
            ],
          },
          include: {
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

      // Send welcome notification to default public channel
      try {
        const joinedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, username: true },
        });
        const targetChannel =
          workspace.channels.find((c) => c.name === 'general' && c.type === 'PUBLIC') ||
          workspace.channels.find((c) => c.type === 'PUBLIC') ||
          workspace.channels[0];

        if (targetChannel) {
          const uName = joinedUser?.displayName || joinedUser?.username || 'A new teammate';
          await sendSystemNotification({
            workspaceId: workspace.id,
            channelId: targetChannel.id,
            content: `👋 **${uName}** joined the workspace! Welcome aboard! 🚀`,
            io: fastify.io,
          });
        }
      } catch (botErr) {
        fastify.log.error(botErr, 'Failed to send workspace join notification');
      }
    }

    return reply.send({ success: true, workspaceId: workspace.id });
  });

  // Add member to workspace by email or username
  fastify.post('/:workspaceId/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const callerId = (request.user as { id: string }).id;

    // Caller must be SUPER_ADMIN or OWNER/ADMIN of this workspace
    const callerUser = await prisma.user.findUnique({
      where: { id: callerId },
      select: { systemRole: true },
    });

    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: callerId } },
    });

    const isAuthorized =
      callerUser?.systemRole === 'SUPER_ADMIN' ||
      callerMember?.role === 'OWNER' ||
      callerMember?.role === 'ADMIN';

    if (!isAuthorized) {
      return reply.status(403).send({ error: 'Only workspace administrators can add new members' });
    }

    const parseResult = addWorkspaceMemberSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'emailOrUsername is required' });
    }

    const { emailOrUsername, role } = parseResult.data;

    // Find target user by email, username, or id
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailOrUsername, mode: 'insensitive' } },
          { username: { equals: emailOrUsername, mode: 'insensitive' } },
          { id: emailOrUsername },
        ],
      },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: `User "${emailOrUsername}" not found. Ensure they have signed up first.` });
    }

    // Check if already in workspace
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
    });

    if (existingMember) {
      return reply.status(400).send({ error: `${targetUser.displayName} is already a member of this workspace` });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: role as any,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            systemRole: true,
          },
        },
      },
    });

    // Auto-join public channels
    const publicChannels = await prisma.channel.findMany({
      where: { workspaceId, type: 'PUBLIC' },
    });

    for (const ch of publicChannels) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: targetUser.id } },
        create: { channelId: ch.id, userId: targetUser.id },
        update: {},
      });
    }

    // Notify default channel
    const defaultChannel =
      publicChannels.find((c) => c.name === 'general') || publicChannels[0];
    if (defaultChannel) {
      try {
        await sendSystemNotification({
          workspaceId,
          channelId: defaultChannel.id,
          content: `👋 **${targetUser.displayName}** was added to the workspace! Welcome! 🎉`,
          io: fastify.io,
        });
      } catch (err) {
        fastify.log.error(err, 'Failed to send welcome message');
      }
    }

    return reply.status(201).send(member);
  });

  // Remove member from workspace
  fastify.delete('/:workspaceId/members/:memberUserId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId, memberUserId } = request.params as { workspaceId: string; memberUserId: string };
    const callerId = (request.user as { id: string }).id;

    const callerUser = await prisma.user.findUnique({
      where: { id: callerId },
      select: { systemRole: true },
    });

    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: callerId } },
    });

    const isAuthorized =
      callerUser?.systemRole === 'SUPER_ADMIN' ||
      callerMember?.role === 'OWNER' ||
      callerMember?.role === 'ADMIN';

    if (!isAuthorized) {
      return reply.status(403).send({ error: 'Only workspace administrators can remove members' });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (workspace?.ownerId === memberUserId) {
      return reply.status(400).send({ error: 'Cannot remove the workspace owner' });
    }

    await prisma.workspaceMember.deleteMany({
      where: { workspaceId, userId: memberUserId },
    });

    // Remove from channels of that workspace
    const channels = await prisma.channel.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    await prisma.channelMember.deleteMany({
      where: {
        userId: memberUserId,
        channelId: { in: channels.map((c) => c.id) },
      },
    });

    return reply.send({ success: true, removedUserId: memberUserId });
  });

  // Update workspace settings (Name, Icon)
  fastify.patch('/:workspaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const callerId = (request.user as { id: string }).id;

    const callerUser = await prisma.user.findUnique({
      where: { id: callerId },
      select: { systemRole: true },
    });

    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: callerId } },
    });

    const isAuthorized =
      callerUser?.systemRole === 'SUPER_ADMIN' ||
      callerMember?.role === 'OWNER' ||
      callerMember?.role === 'ADMIN';

    if (!isAuthorized) {
      return reply.status(403).send({ error: 'Only workspace administrators can update workspace settings' });
    }

    const updateWsSchema = z.object({
      name: z.string().min(2).max(50).optional(),
      iconUrl: z.string().url().optional(),
    });

    const parseResult = updateWsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: parseResult.data,
    });

    return reply.send(updated);
  });

  // Get theme & appearance settings for workspace & member
  fastify.get('/:workspaceId/theme', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const memberSettings = (member.settings as any) || {};
    const workspaceSettings = (workspace?.settings as any) || {};

    const activeTheme = memberSettings.theme || workspaceSettings.defaultTheme || null;

    return reply.send({
      theme: activeTheme,
      memberSettings,
      workspaceSettings,
    });
  });

  // Update theme settings (member's custom theme & optionally workspace default)
  fastify.patch('/:workspaceId/theme', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const themeSchema = z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(50),
      sidebarColor: z.string().min(3).max(30),
      workspaceColor: z.string().min(3).max(30),
      backgroundColor: z.string().min(3).max(30),
      surfaceColor: z.string().min(3).max(30),
      surfaceHoverColor: z.string().min(3).max(30).optional(),
      textColor: z.string().min(3).max(30),
      textMutedColor: z.string().min(3).max(30),
      primaryColor: z.string().min(3).max(30),
      primaryHoverColor: z.string().min(3).max(30).optional(),
      primaryTextColor: z.string().min(3).max(30).optional(),
      secondaryColor: z.string().min(3).max(30),
      borderColor: z.string().min(3).max(30),
    });

    const bodySchema = z.object({
      theme: themeSchema,
      setAsWorkspaceDefault: z.boolean().optional().default(false),
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { theme, setAsWorkspaceDefault } = parseResult.data;

    // Update member's settings
    const existingMemberSettings = (member.settings as any) || {};
    const updatedMemberSettings = {
      ...existingMemberSettings,
      theme,
    };

    await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { settings: updatedMemberSettings },
    });

    let updatedWorkspaceSettings = null;

    // If caller wants to set as workspace default, verify admin/owner rights
    if (setAsWorkspaceDefault) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { systemRole: true },
      });

      const isAuthorized =
        user?.systemRole === 'SUPER_ADMIN' ||
        member.role === 'OWNER' ||
        member.role === 'ADMIN';

      if (isAuthorized) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { settings: true },
        });

        const existingWsSettings = (workspace?.settings as any) || {};
        updatedWorkspaceSettings = {
          ...existingWsSettings,
          defaultTheme: theme,
        };

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { settings: updatedWorkspaceSettings },
        });
      }
    }

    return reply.send({
      success: true,
      theme,
      memberSettings: updatedMemberSettings,
      workspaceSettings: updatedWorkspaceSettings,
    });
  });

  // General Workspace Settings (Extensible for all future workspace settings)
  fastify.patch('/:workspaceId/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });

    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    const isAuthorized =
      callerUser?.systemRole === 'SUPER_ADMIN' ||
      callerMember?.role === 'OWNER' ||
      callerMember?.role === 'ADMIN';

    if (!isAuthorized) {
      return reply.status(403).send({ error: 'Only workspace administrators can update workspace settings' });
    }

    const settingsSchema = z.record(z.any());
    const parseResult = settingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid settings format' });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const existingSettings = (workspace?.settings as any) || {};
    const mergedSettings = {
      ...existingSettings,
      ...parseResult.data,
    };

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: mergedSettings },
    });

    return reply.send({
      success: true,
      settings: updated.settings,
    });
  });
};
