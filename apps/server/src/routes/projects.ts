import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { z } from 'zod';
import { sendTicketBotNotification } from '../services/systemBot.js';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().default('📋'),
  color: z.string().optional().default('#007A5A'),
  notificationChannelId: z.string().uuid().optional().nullable(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
  notificationChannelId: z.string().uuid().optional().nullable(),
});

const reorderColumnsSchema = z.object({
  columnOrders: z.array(z.object({
    id: z.string().uuid(),
    orderIndex: z.number().int(),
  })),
});

const createColumnSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional().default('#6B7280'),
  orderIndex: z.number().int().optional(),
});

const updateColumnSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

const createTicketSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

const updateTicketSchema = z.object({
  columnId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  orderIndex: z.number().int().optional(),
});

const moveTicketSchema = z.object({
  columnId: z.string().uuid(),
  orderIndex: z.number().int().default(0),
});

const createDocumentSchema = z.object({
  title: z.string().min(1).max(255).default('Untitled Document'),
  content: z.string().default(''),
  icon: z.string().optional().default('📄'),
  coverImage: z.string().optional().nullable(),
  isPublicInProject: z.boolean().optional().default(false),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  icon: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  isPublicInProject: z.boolean().optional(),
  isPublicLinkEnabled: z.boolean().optional(),
});

const shareDocumentSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['VIEW', 'EDIT']).default('EDIT'),
});


export const projectRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. List all projects in a workspace
  fastify.get('/workspaces/:workspaceId/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notificationChannel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            columns: true,
            tickets: true,
            documents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(projects);
  });

  // 2. Create a new project with default columns
  fastify.post('/workspaces/:workspaceId/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, description, icon, color, notificationChannelId } = parseResult.data;

    let targetNotifChannelId = notificationChannelId;
    if (!targetNotifChannelId) {
      const generalChannel = await prisma.channel.findFirst({
        where: { workspaceId, name: 'general' },
        select: { id: true },
      });
      targetNotifChannelId = generalChannel?.id || null;
    }

    // Default Kanban columns: Todo, Inprogress, In review, Done
    const defaultColumns = [
      { name: 'Todo', color: '#3B82F6', orderIndex: 0 },
      { name: 'Inprogress', color: '#F59E0B', orderIndex: 1 },
      { name: 'In review', color: '#8B5CF6', orderIndex: 2 },
      { name: 'Done', color: '#10B981', orderIndex: 3 },
    ];

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name,
        description,
        icon,
        color,
        notificationChannelId: targetNotifChannelId,
        createdById: userId,
        columns: {
          create: defaultColumns,
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notificationChannel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        columns: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            columns: true,
            tickets: true,
            documents: true,
          },
        },
      },
    });

    fastify.io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.PROJECT_NEW, project);

    return reply.status(201).send(project);
  });

  // 3. Get project details with full columns & tickets
  fastify.get('/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notificationChannel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        columns: {
          orderBy: { orderIndex: 'asc' },
          include: {
            tickets: {
              orderBy: { orderIndex: 'asc' },
              include: {
                creator: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
                assignee: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            columns: true,
            tickets: true,
            documents: true,
          },
        },
      },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    return reply.send(project);
  });

  // 4. Update project details
  fastify.put('/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const parseResult = updateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: parseResult.data,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notificationChannel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.PROJECT_UPDATE, updated);

    return reply.send(updated);
  });

  // 5. Delete project
  fastify.delete('/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    await prisma.project.delete({ where: { id: projectId } });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.PROJECT_DELETE, {
      projectId,
      workspaceId: project.workspaceId,
    });

    return reply.send({ success: true, message: 'Project deleted' });
  });

  // 6. Create Column in Project
  fastify.post('/:projectId/columns', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const parseResult = createColumnSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { name, color, orderIndex } = parseResult.data;

    const count = await prisma.projectColumn.count({ where: { projectId } });
    const colOrder = orderIndex !== undefined ? orderIndex : count;

    const column = await prisma.projectColumn.create({
      data: {
        projectId,
        name,
        color,
        orderIndex: colOrder,
      },
      include: {
        tickets: true,
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.COLUMN_NEW, column);

    return reply.status(201).send(column);
  });

  // 7. Update Column
  fastify.put('/:projectId/columns/:columnId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, columnId } = request.params as { projectId: string; columnId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const parseResult = updateColumnSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const updated = await prisma.projectColumn.update({
      where: { id: columnId },
      data: parseResult.data,
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.COLUMN_UPDATE, updated);

    return reply.send(updated);
  });

  // 8. Delete Column
  fastify.delete('/:projectId/columns/:columnId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, columnId } = request.params as { projectId: string; columnId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    await prisma.projectColumn.delete({ where: { id: columnId } });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.COLUMN_DELETE, {
      columnId,
      projectId,
    });

    return reply.send({ success: true, message: 'Column deleted' });
  });

  // 8b. Reorder Columns
  fastify.patch('/:projectId/columns/reorder', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const parseResult = reorderColumnsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { columnOrders } = parseResult.data;

    await prisma.$transaction(
      columnOrders.map((item) =>
        prisma.projectColumn.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        })
      )
    );

    const updatedColumns = await prisma.projectColumn.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
      include: {
        tickets: {
          orderBy: { orderIndex: 'asc' },
          include: {
            creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            assignee: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.COLUMN_REORDER, {
      projectId,
      columns: updatedColumns,
    });

    return reply.send({ success: true, columns: updatedColumns });
  });

  // 9. Create Ticket
  fastify.post('/:projectId/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const parseResult = createTicketSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { columnId, title, description, priority, dueDate, assigneeId } = parseResult.data;

    // Check column exists
    const column = await prisma.projectColumn.findFirst({
      where: { id: columnId, projectId },
    });
    if (!column) return reply.status(400).send({ error: 'Invalid column ID' });

    // Order index at bottom of column
    const ticketCount = await prisma.ticket.count({ where: { columnId } });

    const ticket = await prisma.ticket.create({
      data: {
        projectId,
        columnId,
        title,
        description,
        priority,
        orderIndex: ticketCount,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: userId,
        assigneeId: assigneeId || null,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        column: true,
      },
    });

    // Notify assignee via Orbit Bot if assigned and send channel activity
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const actorName = actor?.displayName || 'A team member';

    const targetUserIds: string[] = [];
    if (assigneeId && assigneeId !== userId) {
      targetUserIds.push(assigneeId);
    }

    const actionText = assigneeId && assigneeId !== userId && ticket.assignee
      ? `created ticket and assigned to @${ticket.assignee.displayName}`
      : 'created ticket';

    await sendTicketBotNotification({
      workspaceId: project.workspaceId,
      actorName,
      ticketTitle: ticket.title,
      projectName: project.name,
      actionText,
      targetUserIds,
      channelId: project.notificationChannelId,
      io: fastify.io,
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.TICKET_NEW, ticket);

    return reply.status(201).send(ticket);
  });

  // 10. Update Ticket
  fastify.put('/:projectId/tickets/:ticketId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, ticketId } = request.params as { projectId: string; ticketId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const existingTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existingTicket) return reply.status(404).send({ error: 'Ticket not found' });

    const parseResult = updateTicketSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { columnId, title, description, priority, dueDate, assigneeId, orderIndex } = parseResult.data;

    const dataToUpdate: any = {};
    if (columnId !== undefined) dataToUpdate.columnId = columnId;
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) dataToUpdate.assigneeId = assigneeId;
    if (orderIndex !== undefined) dataToUpdate.orderIndex = orderIndex;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: dataToUpdate,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        column: true,
      },
    });

    // Check if assignee changed
    if (assigneeId && assigneeId !== existingTicket.assigneeId && assigneeId !== userId) {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      await sendTicketBotNotification({
        workspaceId: project.workspaceId,
        actorName: actor?.displayName || 'A team member',
        ticketTitle: updated.title,
        projectName: project.name,
        actionText: 'assigned you to ticket',
        targetUserIds: [assigneeId],
        channelId: project.notificationChannelId,
        io: fastify.io,
      });
    }

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.TICKET_UPDATE, updated);

    return reply.send(updated);
  });

  // 11. Move Ticket (Drag & Drop column or reorder)
  fastify.patch('/:projectId/tickets/:ticketId/move', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, ticketId } = request.params as { projectId: string; ticketId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { column: true },
    });
    if (!existingTicket) return reply.status(404).send({ error: 'Ticket not found' });

    const parseResult = moveTicketSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { columnId: newColumnId, orderIndex: newOrderIndex } = parseResult.data;

    const targetColumn = await prisma.projectColumn.findFirst({
      where: { id: newColumnId, projectId },
    });
    if (!targetColumn) return reply.status(400).send({ error: 'Target column not found' });

    const previousColumnId = existingTicket.columnId;
    const isColumnChanged = previousColumnId !== newColumnId;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        columnId: newColumnId,
        orderIndex: newOrderIndex,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        column: true,
      },
    });

    // If moved to a new column, notify respective members via Orbit Bot!
    if (isColumnChanged) {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      const actorName = actor?.displayName || 'A team member';

      const targetsToNotify: string[] = [];
      if (updated.assigneeId && updated.assigneeId !== userId) {
        targetsToNotify.push(updated.assigneeId);
      }
      if (updated.createdById && updated.createdById !== userId && updated.createdById !== updated.assigneeId) {
        targetsToNotify.push(updated.createdById);
      }

      await sendTicketBotNotification({
        workspaceId: project.workspaceId,
        actorName,
        ticketTitle: updated.title,
        projectName: project.name,
        actionText: `moved ticket to "${targetColumn.name}"`,
        targetUserIds: targetsToNotify,
        channelId: project.notificationChannelId,
        io: fastify.io,
      });
    }

    // Broadcast ticket move event to all workspace members
    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.TICKET_MOVE, {
      ticket: updated,
      fromColumnId: previousColumnId,
      toColumnId: newColumnId,
      orderIndex: newOrderIndex,
      projectId,
    });

    return reply.send(updated);
  });

  // 12. Delete Ticket
  fastify.delete('/:projectId/tickets/:ticketId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, ticketId } = request.params as { projectId: string; ticketId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

    await prisma.ticket.delete({ where: { id: ticketId } });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.TICKET_DELETE, {
      ticketId,
      projectId,
      columnId: ticket.columnId,
    });

    return reply.send({ success: true, message: 'Ticket deleted' });
  });

  // ==========================================
  // Document (Docs) Routes
  // ==========================================

  // 13. Public shareable document link endpoint
  fastify.get('/documents/share/:shareToken', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string };

    const doc = await prisma.projectDocument.findUnique({
      where: { shareToken },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    if (!doc || !doc.isPublicLinkEnabled) {
      return reply.status(404).send({ error: 'Shared document not found or link is disabled' });
    }

    return reply.send(doc);
  });

  // 14. List documents in project (respects visibility rules)
  fastify.get('/:projectId/documents', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized: not a workspace member' });

    // Documents are visible if:
    // 1. isPublicInProject is true
    // 2. Or current user is the document creator
    // 3. Or document has been shared with current user
    const documents = await prisma.projectDocument.findMany({
      where: {
        projectId,
        OR: [
          { isPublicInProject: true },
          { createdById: userId },
          { shares: { some: { userId } } },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send(documents);
  });

  // 15. Create document in project
  fastify.post('/:projectId/documents', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized: not a workspace member' });

    const parseResult = createDocumentSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { title, content, icon, coverImage, isPublicInProject } = parseResult.data;

    const newDoc = await prisma.projectDocument.create({
      data: {
        projectId,
        workspaceId: project.workspaceId,
        title: title || 'Untitled Document',
        content: content || '',
        icon: icon || '📄',
        coverImage: coverImage || null,
        isPublicInProject: isPublicInProject ?? false,
        createdById: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.DOCUMENT_NEW, newDoc);

    return reply.status(201).send(newDoc);
  });

  // 16. Get single document by ID
  fastify.get('/:projectId/documents/:documentId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, documentId } = request.params as { projectId: string; documentId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const doc = await prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!doc || doc.projectId !== projectId) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    // Permission check
    const isCreator = doc.createdById === userId;
    const isPublic = doc.isPublicInProject;
    const isShared = doc.shares.some((s) => s.userId === userId);

    if (!isCreator && !isPublic && !isShared) {
      return reply.status(403).send({ error: 'You do not have permission to view this document' });
    }

    return reply.send(doc);
  });

  // 17. Update document
  fastify.patch('/:projectId/documents/:documentId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, documentId } = request.params as { projectId: string; documentId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const doc = await prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        shares: true,
      },
    });

    if (!doc || doc.projectId !== projectId) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const isCreator = doc.createdById === userId;
    const isWorkspaceAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
    const hasEditShare = doc.shares.some((s) => s.userId === userId && s.permission === 'EDIT');
    const isPublicInProject = doc.isPublicInProject;

    const canEditContent = isCreator || isWorkspaceAdmin || hasEditShare || isPublicInProject;
    if (!canEditContent) {
      return reply.status(403).send({ error: 'You do not have permission to edit this document' });
    }

    const parseResult = updateDocumentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { title, content, icon, coverImage, isPublicInProject: nextPublic, isPublicLinkEnabled } = parseResult.data;

    // Only creator or admin can change public project visibility or public link status
    if ((nextPublic !== undefined || isPublicLinkEnabled !== undefined) && !isCreator && !isWorkspaceAdmin) {
      return reply.status(403).send({ error: 'Only the document creator or admin can change sharing settings' });
    }

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (content !== undefined) dataToUpdate.content = content;
    if (icon !== undefined) dataToUpdate.icon = icon;
    if (coverImage !== undefined) dataToUpdate.coverImage = coverImage;
    if (nextPublic !== undefined) dataToUpdate.isPublicInProject = nextPublic;
    if (isPublicLinkEnabled !== undefined) dataToUpdate.isPublicLinkEnabled = isPublicLinkEnabled;

    const updated = await prisma.projectDocument.update({
      where: { id: documentId },
      data: dataToUpdate,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.DOCUMENT_UPDATE, updated);

    return reply.send(updated);
  });

  // 18. Delete document
  fastify.delete('/:projectId/documents/:documentId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, documentId } = request.params as { projectId: string; documentId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const doc = await prisma.projectDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.projectId !== projectId) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const isCreator = doc.createdById === userId;
    const isWorkspaceAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';

    if (!isCreator && !isWorkspaceAdmin) {
      return reply.status(403).send({ error: 'Only the creator or workspace admin can delete this document' });
    }

    await prisma.projectDocument.delete({ where: { id: documentId } });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.DOCUMENT_DELETE, {
      documentId,
      projectId,
    });

    return reply.send({ success: true, message: 'Document deleted' });
  });

  // 19. Add or update user share on document
  fastify.post('/:projectId/documents/:documentId/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, documentId } = request.params as { projectId: string; documentId: string };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const doc = await prisma.projectDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.projectId !== projectId) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const isCreator = doc.createdById === userId;
    const isWorkspaceAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
    if (!isCreator && !isWorkspaceAdmin) {
      return reply.status(403).send({ error: 'Only the creator or admin can manage document sharing' });
    }

    const parseResult = shareDocumentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.errors[0].message });
    }

    const { userId: targetUserId, permission } = parseResult.data;

    // Verify target user is in the same workspace
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: targetUserId } },
    });
    if (!targetMember) {
      return reply.status(400).send({ error: 'Selected user is not a member of this workspace' });
    }

    await prisma.projectDocumentShare.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: targetUserId,
        },
      },
      update: {
        permission,
      },
      create: {
        documentId,
        userId: targetUserId,
        permission,
      },
    });

    const updatedDoc = await prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.DOCUMENT_UPDATE, updatedDoc);

    return reply.send(updatedDoc);
  });

  // 20. Remove user share from document
  fastify.delete('/:projectId/documents/:documentId/shares/:targetUserId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, documentId, targetUserId } = request.params as {
      projectId: string;
      documentId: string;
      targetUserId: string;
    };
    const userId = (request.user as { id: string }).id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!membership) return reply.status(403).send({ error: 'Unauthorized' });

    const doc = await prisma.projectDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.projectId !== projectId) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const isCreator = doc.createdById === userId;
    const isWorkspaceAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
    if (!isCreator && !isWorkspaceAdmin && userId !== targetUserId) {
      return reply.status(403).send({ error: 'Unauthorized to remove this share' });
    }

    await prisma.projectDocumentShare.deleteMany({
      where: {
        documentId,
        userId: targetUserId,
      },
    });

    const updatedDoc = await prisma.projectDocument.findUnique({
      where: { id: documentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        shares: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    fastify.io.to(`workspace:${project.workspaceId}`).emit(SOCKET_EVENTS.DOCUMENT_UPDATE, updatedDoc);

    return reply.send(updatedDoc);
  });
};

