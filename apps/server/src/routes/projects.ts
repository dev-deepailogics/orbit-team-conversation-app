import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { hasWorkspacePermission } from "../services/permissions.js";
import { prisma } from "@orbit/db";
import { SOCKET_EVENTS } from "@orbit/types";
import { z } from "zod";
import { sendTicketBotNotification } from "../services/systemBot.js";

// Ticket images are files the user uploaded with /api/files/upload, which records each upload when it happens, so
// there is nothing to create here. (This used to create records for any storage path a client named, which let someone
// claim another user's file.)

// User ids are UUIDs for new users but Firebase UIDs for migrated ones — accept both.
const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().default("📋"),
  color: z.string().optional().default("#007A5A"),
  status: z
    .enum(["active", "inactive", "delivered"])
    .optional()
    .default("active"),
  notificationChannelId: z.string().uuid().optional().nullable(),
  assignedEmployees: z.any().optional(),
  selectedManagers: z.any().optional(),
  slackMentions: z.any().optional(),
  clientUid: z.string().optional().nullable(),
  clientUsername: z.string().optional().nullable(),
  clientEmail: z.string().optional().nullable(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(["active", "inactive", "delivered"]).optional(),
  notificationChannelId: z.string().uuid().optional().nullable(),
  assignedEmployees: z.any().optional(),
  selectedManagers: z.any().optional(),
  slackMentions: z.any().optional(),
  clientUid: z.string().optional().nullable(),
  clientUsername: z.string().optional().nullable(),
  clientEmail: z.string().optional().nullable(),
});

const reorderColumnsSchema = z.object({
  columnOrders: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int(),
    }),
  ),
});

const createColumnSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional().default("#6B7280"),
  orderIndex: z.number().int().optional(),
});

const updateColumnSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

const TICKET_TYPES = ["TASK", "BUG", "STORY", "EPIC"] as const;

/** "Sara", "Sara and Ali", "Sara, Ali and Omar". */
const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// Which user-visible fields an update actually changes (the edit form re-sends every field on each save, so compare
// with what's stored). Used to tell people a ticket was edited; checklist ticks, ordering and the git branch are too
// minor to notify about.
function describeTicketEdits(existing: any, data: z.infer<typeof updateTicketSchema>): string[] {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
  const changed: string[] = [];
  if (data.title !== undefined && data.title !== existing.title) changed.push("title");
  if (data.description !== undefined && text(data.description) !== text(existing.description)) changed.push("description");
  if (data.priority !== undefined && data.priority !== existing.priority) changed.push("priority");
  if (data.type !== undefined && data.type !== existing.type) changed.push("type");
  if (data.dueDate !== undefined) {
    const next = data.dueDate ? new Date(data.dueDate).getTime() : null;
    const prev = existing.dueDate ? new Date(existing.dueDate).getTime() : null;
    if (next !== prev) changed.push("due date");
  }
  if (data.storyPoints !== undefined && (data.storyPoints ?? null) !== (existing.storyPoints ?? null)) changed.push("story points");
  if (data.labels !== undefined && JSON.stringify(data.labels ?? null) !== JSON.stringify(existing.labels ?? null)) changed.push("labels");
  if (data.notes !== undefined && text(data.notes) !== text(existing.notes)) changed.push("notes");
  if (data.testPlan !== undefined && text(data.testPlan) !== text(existing.testPlan)) changed.push("test plan");
  return changed;
}

const createTicketSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  type: z.enum(TICKET_TYPES).default("TASK"),
  dueDate: z.string().optional().nullable(),
  assigneeId: userIdSchema.optional().nullable(),
  // Multi-assign: [{ uid: <user id>, name }]. assigneeId mirrors the first entry for older clients.
  assignees: z
    .array(z.object({ uid: userIdSchema, name: z.string() }))
    .max(50)
    .optional()
    .nullable(),
  images: z.any().optional().nullable(),
});

const updateTicketSchema = z.object({
  columnId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeId: userIdSchema.optional().nullable(),
  // Multi-assign: [{ uid: <user id>, name }]. assigneeId mirrors the first entry for older clients.
  assignees: z
    .array(z.object({ uid: userIdSchema, name: z.string() }))
    .max(50)
    .optional()
    .nullable(),
  orderIndex: z.number().int().optional(),
  gitbranch: z.string().optional().nullable(),
  checklist: z.any().optional().nullable(),
  labels: z.any().optional().nullable(),
  images: z.any().optional().nullable(),
  storyPoints: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  testPlan: z.string().optional().nullable(),
});

const moveTicketSchema = z.object({
  columnId: z.string().uuid(),
  orderIndex: z.number().int().default(0),
});

const ticketPageSchema = z.coerce.number().int().min(1).max(100);

const ticketUserSelect = {
  select: { id: true, username: true, displayName: true, avatarUrl: true },
};
const ticketListInclude = {
  creator: ticketUserSelect,
  assignee: ticketUserSelect,
  _count: { select: { comments: true } },
};
// Newest first: tickets join a column with orderIndex = max + 1, so the highest
// orderIndex is the ticket most recently created in / moved into the column.
const recentTicketOrder: Array<
  { orderIndex: "desc" } | { createdAt: "desc" } | { id: "desc" }
> = [{ orderIndex: "desc" }, { createdAt: "desc" }, { id: "desc" }];

// Returns the error to send, or null when the user may view the project.
export async function projectAccessError(
  project: {
    workspaceId: string;
    createdById: string;
    assignedEmployees: unknown;
    selectedManagers: unknown;
  },
  userId: string,
): Promise<{ status: number; error: string } | null> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: project.workspaceId, userId },
    },
    include: {
      user: {
        select: {
          id: true,
          systemRole: true,
          displayName: true,
          username: true,
        },
      },
    },
  });
  if (!membership) {
    return { status: 403, error: "You are not a member of this workspace" };
  }

  const isAdmin =
    hasWorkspacePermission(membership.role, "manageAllProjects", membership.user.systemRole) ||
    membership.user.systemRole === "WORKSPACE_ADMIN";
  if (isAdmin || project.createdById === userId) return null;

  const userName = (
    membership.user.displayName ||
    membership.user.username ||
    ""
  ).toLowerCase();
  const assigned = Array.isArray(project.assignedEmployees)
    ? (project.assignedEmployees as any[])
    : [];
  const managers = Array.isArray(project.selectedManagers)
    ? (project.selectedManagers as any[])
    : [];

  const isAssigned = assigned.some((e: any) => {
    if (!e) return false;
    if (typeof e === "string") return e.toLowerCase() === userName;
    if (e.uid && e.uid === userId) return true;
    if (e.name && e.name.toLowerCase() === userName) return true;
    return false;
  });

  const isManager = managers.some((m: any) => {
    if (!m) return false;
    if (typeof m === "string") return m.toLowerCase() === userName;
    if (m.uid && m.uid === userId) return true;
    if (m.name && m.name.toLowerCase() === userName) return true;
    return false;
  });

  if (!isAssigned && !isManager) {
    return { status: 403, error: "You are not assigned to this project" };
  }
  return null;
}

export const projectRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  // 1. List all projects in a workspace
  fastify.get(
    "/workspaces/:workspaceId/projects",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const userId = (request.user as { id: string }).id;

      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: {
          user: {
            select: {
              id: true,
              systemRole: true,
              displayName: true,
              username: true,
            },
          },
        },
      });
      if (!membership) {
        return reply
          .status(403)
          .send({ error: "You are not a member of this workspace" });
      }

      const { status } = request.query as { status?: string };

      const whereClause: any = { workspaceId };
      if (status) {
        whereClause.status = { equals: status, mode: "insensitive" };
      }

      const isAdmin =
        hasWorkspacePermission(membership.role, "manageAllProjects", membership.user.systemRole) ||
        membership.user.systemRole === "WORKSPACE_ADMIN";

      const projects = await prisma.project.findMany({
        where: whereClause,
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
        orderBy: { createdAt: "desc" },
      });

      if (isAdmin) {
        return reply.send(projects);
      }

      // Filter projects for non-admin members: must be creator, assigned, or manager
      const filteredProjects = projects.filter((p: any) => {
        if (p.createdById === userId) return true;

        const userName = (
          membership.user.displayName ||
          membership.user.username ||
          ""
        ).toLowerCase();

        const assigned = Array.isArray(p.assignedEmployees)
          ? p.assignedEmployees
          : [];
        const isAssigned = assigned.some((e: any) => {
          if (!e) return false;
          if (typeof e === "string") return e.toLowerCase() === userName;
          if (e.uid && e.uid === userId) return true;
          if (e.name && e.name.toLowerCase() === userName) return true;
          return false;
        });
        if (isAssigned) return true;

        const managers = Array.isArray(p.selectedManagers)
          ? p.selectedManagers
          : [];
        const isManager = managers.some((m: any) => {
          if (!m) return false;
          if (typeof m === "string") return m.toLowerCase() === userName;
          if (m.uid && m.uid === userId) return true;
          if (m.name && m.name.toLowerCase() === userName) return true;
          return false;
        });
        if (isManager) return true;

        return false;
      });

      return reply.send(filteredProjects);
    },
  );

  // 2. Create a new project with default columns
  fastify.post(
    "/workspaces/:workspaceId/projects",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const userId = (request.user as { id: string }).id;

      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!membership) {
        return reply
          .status(403)
          .send({ error: "You are not a member of this workspace" });
      }

      const parseResult = createProjectSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const {
        name,
        description,
        icon,
        color,
        status,
        notificationChannelId,
        assignedEmployees,
        selectedManagers,
        slackMentions,
        clientUid,
        clientUsername,
        clientEmail,
      } = parseResult.data;

      // Project names must be unique within the same workspace (case-insensitive)
      const existingProject = await prisma.project.findFirst({
        where: {
          workspaceId,
          name: { equals: name.trim(), mode: "insensitive" },
        },
      });

      if (existingProject) {
        return reply.status(409).send({
          error: `A project named "${name.trim()}" already exists in this workspace`,
        });
      }

      let targetNotifChannelId = notificationChannelId;
      if (!targetNotifChannelId) {
        const generalChannel = await prisma.channel.findFirst({
          where: { workspaceId, name: "general" },
          select: { id: true },
        });
        targetNotifChannelId = generalChannel?.id || null;
      }

      // Default Kanban columns: Todo, Inprogress, In review, Done
      const defaultColumns = [
        { name: "Todo", color: "#3B82F6", orderIndex: 0 },
        { name: "Inprogress", color: "#F59E0B", orderIndex: 1 },
        { name: "In review", color: "#8B5CF6", orderIndex: 2 },
        { name: "Done", color: "#10B981", orderIndex: 3 },
      ];

      const project = await prisma.project.create({
        data: {
          workspaceId,
          name,
          description,
          icon,
          color,
          status: status || "active",
          assignedEmployees: assignedEmployees ?? undefined,
          selectedManagers: selectedManagers ?? undefined,
          slackMentions: slackMentions ?? undefined,
          clientUid: clientUid ?? null,
          clientUsername: clientUsername ?? null,
          clientEmail: clientEmail ?? null,
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
            orderBy: { orderIndex: "asc" },
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

      fastify.io
        .to(`workspace:${workspaceId}`)
        .emit(SOCKET_EVENTS.PROJECT_NEW, project);

      return reply.status(201).send(project);
    },
  );

  // 3. Get project details with columns & tickets.
  // ?ticketLimit=N returns only the N most recent tickets per column (newest
  // first); page further with GET /:projectId/columns/:columnId/tickets.
  // Without it, every ticket is returned in board order (mobile relies on this).
  fastify.get(
    "/:projectId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;
      const { ticketLimit } = request.query as { ticketLimit?: string };

      let limit: number | undefined;
      if (ticketLimit !== undefined) {
        const parsed = ticketPageSchema.safeParse(ticketLimit);
        if (!parsed.success) {
          return reply.status(400).send({ error: "Invalid ticketLimit" });
        }
        limit = parsed.data;
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          creator: ticketUserSelect,
          notificationChannel: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          columns: {
            orderBy: { orderIndex: "asc" },
            include: {
              tickets: limit
                ? {
                    orderBy: recentTicketOrder,
                    take: limit,
                    include: ticketListInclude,
                  }
                : {
                    orderBy: { orderIndex: "asc" },
                    include: ticketListInclude,
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
        return reply.status(404).send({ error: "Project not found" });
      }

      const denied = await projectAccessError(project, userId);
      if (denied) return reply.status(denied.status).send({ error: denied.error });

      return reply.send(project);
    },
  );

  // 3b. Next page of a column's tickets, newest first (pairs with ?ticketLimit)
  fastify.get(
    "/:projectId/columns/:columnId/tickets",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, columnId } = request.params as {
        projectId: string;
        columnId: string;
      };
      const userId = (request.user as { id: string }).id;
      const query = request.query as { skip?: string; take?: string };

      const skip = z.coerce.number().int().min(0).safeParse(query.skip ?? 0);
      const take = ticketPageSchema.safeParse(query.take ?? 20);
      if (!skip.success || !take.success) {
        return reply.status(400).send({ error: "Invalid skip/take" });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const denied = await projectAccessError(project, userId);
      if (denied) return reply.status(denied.status).send({ error: denied.error });

      // ponytail: offset paging; concurrent inserts/deletes can shift a page by
      // a ticket (client dedupes by id). Switch to a keyset cursor if that bites.
      const tickets = await prisma.ticket.findMany({
        where: { columnId, projectId },
        orderBy: recentTicketOrder,
        skip: skip.data,
        take: take.data,
        include: ticketListInclude,
      });

      return reply.send(tickets);
    },
  );

  // 4. Update project details
  fastify.put(
    "/:projectId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const parseResult = updateProjectSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      // If renaming project, ensure the new name is unique within the workspace
      if (
        parseResult.data.name &&
        parseResult.data.name.trim().toLowerCase() !== project.name.toLowerCase()
      ) {
        const existingProject = await prisma.project.findFirst({
          where: {
            workspaceId: project.workspaceId,
            name: { equals: parseResult.data.name.trim(), mode: "insensitive" },
            id: { not: projectId },
          },
        });
        if (existingProject) {
          return reply.status(409).send({
            error: `A project named "${parseResult.data.name.trim()}" already exists in this workspace`,
          });
        }
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

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.PROJECT_UPDATE, updated);

      return reply.send(updated);
    },
  );

  // 5. Delete project
  fastify.delete(
    "/:projectId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      await prisma.project.delete({ where: { id: projectId } });

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.PROJECT_DELETE, {
          projectId,
          workspaceId: project.workspaceId,
        });

      return reply.send({ success: true, message: "Project deleted" });
    },
  );

  // 6. Create Column in Project
  fastify.post(
    "/:projectId/columns",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const parseResult = createColumnSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
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

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.COLUMN_NEW, column);

      return reply.status(201).send(column);
    },
  );

  // 7. Update Column
  fastify.put(
    "/:projectId/columns/:columnId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, columnId } = request.params as {
        projectId: string;
        columnId: string;
      };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const parseResult = updateColumnSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const updated = await prisma.projectColumn.update({
        where: { id: columnId },
        data: parseResult.data,
      });

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.COLUMN_UPDATE, updated);

      return reply.send(updated);
    },
  );

  // 8. Delete Column
  fastify.delete(
    "/:projectId/columns/:columnId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, columnId } = request.params as {
        projectId: string;
        columnId: string;
      };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      await prisma.projectColumn.delete({ where: { id: columnId } });

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.COLUMN_DELETE, {
          columnId,
          projectId,
        });

      return reply.send({ success: true, message: "Column deleted" });
    },
  );

  // 8b. Reorder Columns
  fastify.patch(
    "/:projectId/columns/reorder",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const parseResult = reorderColumnsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const { columnOrders } = parseResult.data;

      await prisma.$transaction(
        columnOrders.map((item) =>
          prisma.projectColumn.update({
            where: { id: item.id },
            data: { orderIndex: item.orderIndex },
          }),
        ),
      );

      // Columns only: clients keep the tickets they already loaded.
      const updatedColumns = await prisma.projectColumn.findMany({
        where: { projectId },
        orderBy: { orderIndex: "asc" },
      });

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.COLUMN_REORDER, {
          projectId,
          columns: updatedColumns,
        });

      return reply.send({ success: true, columns: updatedColumns });
    },
  );

  // 9. Create Ticket
  fastify.post(
    "/:projectId/tickets",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const parseResult = createTicketSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const { columnId, title, description, priority, type, dueDate, assignees, images } =
        parseResult.data;
      const assigneeId =
        parseResult.data.assigneeId ?? assignees?.[0]?.uid ?? null;

      // Check column exists
      const column = await prisma.projectColumn.findFirst({
        where: { id: columnId, projectId },
      });
      if (!column)
        return reply.status(400).send({ error: "Invalid column ID" });

      // New tickets go on top of the column (highest orderIndex = most recent)
      const { _max } = await prisma.ticket.aggregate({
        where: { columnId },
        _max: { orderIndex: true },
      });
      const nextOrderIndex = (_max.orderIndex ?? -1) + 1;

      // Fetch creator name for initial event log & notifications
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, username: true },
      });
      const actorName = actor?.displayName || actor?.username || "Team Member";

      const initialEvents = [
        {
          id: `evt-${Date.now()}-0`,
          type: "created",
          action: `Created to ${column.name}`,
          user: actorName,
          date: new Date().toISOString(),
          color: "#3B82F6",
        },
      ];

      // Next number in this project (1, 2, 3…). The increment locks the project row until the ticket is created, so two
      // tickets created at once can never get the same number, and a failed create doesn't use one up.
      const ticket = await prisma.$transaction(async (tx) => {
        const { ticketCounter } = await tx.project.update({
          where: { id: projectId },
          data: { ticketCounter: { increment: 1 } },
          select: { ticketCounter: true },
        });
        return tx.ticket.create({
          data: {
            projectId,
            columnId,
            issueNumber: ticketCounter,
            title,
            description,
            priority,
            type,
            orderIndex: nextOrderIndex,
            dueDate: dueDate ? new Date(dueDate) : null,
            createdById: userId,
            assigneeId: assigneeId || null,
            assignees: assignees ?? undefined,
            images: images ?? undefined,
            events: initialEvents,
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
      });


      const targetUserIds = [
        ...new Set([
          ...(assigneeId ? [assigneeId] : []),
          ...(assignees ?? []).map((a) => a.uid),
        ]),
      ].filter((id) => id !== userId);

      const actionText =
        targetUserIds.length > 0 && ticket.assignee
          ? `created ticket and assigned to @${ticket.assignee.displayName}`
          : "created ticket";

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

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.TICKET_NEW, ticket);

      return reply.status(201).send(ticket);
    },
  );

  // 10. Update Ticket
  fastify.put(
    "/:projectId/tickets/:ticketId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, ticketId } = request.params as {
        projectId: string;
        ticketId: string;
      };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const existingTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { column: true },
      });
      if (!existingTicket)
        return reply.status(404).send({ error: "Ticket not found" });

      const parseResult = updateTicketSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const {
        columnId,
        title,
        description,
        priority,
        type,
        dueDate,
        assignees,
        orderIndex,
        gitbranch,
        checklist,
        labels,
        images,
        storyPoints,
        notes,
        testPlan,
      } = parseResult.data;
      const assigneeId =
        parseResult.data.assigneeId !== undefined || assignees === undefined
          ? parseResult.data.assigneeId
          : (assignees?.[0]?.uid ?? null);
      const previousAssigneeIds = new Set<string>([
        ...(existingTicket.assigneeId ? [existingTicket.assigneeId] : []),
        ...(Array.isArray(existingTicket.assignees)
          ? (existingTicket.assignees as any[]).map((a) => a?.uid)
          : []),
      ]);
      const newAssigneeIds = (
        assignees ?? (assigneeId ? [{ uid: assigneeId }] : [])
      )
        .map((a) => a.uid)
        .filter((id) => !previousAssigneeIds.has(id) && id !== userId);

      let updatedEvents = Array.isArray(existingTicket.events)
        ? [...(existingTicket.events as any[])]
        : [];

      const editedFields = describeTicketEdits(existingTicket, parseResult.data);
      let movedToColumnName: string | null = null;

      if (columnId && columnId !== existingTicket.columnId) {
        const targetColumn = await prisma.projectColumn.findUnique({
          where: { id: columnId },
        });
        movedToColumnName = targetColumn?.name ?? null;
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, username: true },
        });
        const actorName =
          actor?.displayName || actor?.username || "Team Member";
        const prevColName = existingTicket.column?.name || "status";

        updatedEvents.push({
          id: `evt-${Date.now()}-${updatedEvents.length}`,
          type: "status_change",
          action: `Status Change from ${prevColName} to ${targetColumn?.name || "status"}`,
          user: actorName,
          date: new Date().toISOString(),
          color: "#10B981",
        });
      }

      const dataToUpdate: any = {};
      if (columnId !== undefined) dataToUpdate.columnId = columnId;
      if (title !== undefined) dataToUpdate.title = title;
      if (description !== undefined) dataToUpdate.description = description;
      if (priority !== undefined) dataToUpdate.priority = priority;
      if (type !== undefined) dataToUpdate.type = type;
      if (dueDate !== undefined)
        dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
      if (assigneeId !== undefined) dataToUpdate.assigneeId = assigneeId;
      if (assignees !== undefined) dataToUpdate.assignees = assignees ?? [];
      // The web form picks a single assignee and doesn't send the assignees list. Keep that list in step when the
      // assignee changes, or it keeps people who were replaced and later re-assigning one of them looks like
      // "already assigned", so they would never be told.
      if (assignees === undefined && assigneeId !== undefined && assigneeId !== existingTicket.assigneeId) {
        const picked = assigneeId
          ? await prisma.user.findUnique({ where: { id: assigneeId }, select: { displayName: true, username: true } })
          : null;
        dataToUpdate.assignees = assigneeId ? [{ uid: assigneeId, name: picked?.displayName || picked?.username || "" }] : [];
      }
      if (orderIndex !== undefined) dataToUpdate.orderIndex = orderIndex;
      if (gitbranch !== undefined) dataToUpdate.gitbranch = gitbranch;
      if (checklist !== undefined) dataToUpdate.checklist = checklist;
      if (labels !== undefined) dataToUpdate.labels = labels;
      if (images !== undefined) dataToUpdate.images = images;
      if (storyPoints !== undefined) dataToUpdate.storyPoints = storyPoints;
      if (notes !== undefined) dataToUpdate.notes = notes;
      if (testPlan !== undefined) dataToUpdate.testPlan = testPlan;
      if (
        updatedEvents.length >
        (Array.isArray(existingTicket.events)
          ? (existingTicket.events as any[]).length
          : 0)
      ) {
        dataToUpdate.events = updatedEvents;
      }

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

      // Names for the messages: the actor, plus the new assignees (the shared channel message names them).
      // One query for all of them, and none when there's nothing to announce.
      const hasEdits = editedFields.length > 0 || !!movedToColumnName;
      const people =
        newAssigneeIds.length > 0 || hasEdits
          ? await prisma.user.findMany({
              where: { id: { in: [userId, ...newAssigneeIds] } },
              select: { id: true, displayName: true, username: true },
            })
          : [];
      const nameOf = (id: string) => {
        const p = people.find((x) => x.id === id);
        return p?.displayName || p?.username || "a team member";
      };
      const actorName = people.some((p) => p.id === userId) ? nameOf(userId) : "A team member";

      const editParts: string[] = [];
      if (editedFields.length > 0) editParts.push(`edited ticket (${editedFields.join(", ")})`);
      if (movedToColumnName) {
        editParts.push(editedFields.length > 0 ? `moved it to "${movedToColumnName}"` : `moved ticket to "${movedToColumnName}"`);
      }

      if (newAssigneeIds.length > 0) {
        await sendTicketBotNotification({
          workspaceId: project.workspaceId,
          actorName,
          ticketTitle: updated.title,
          projectName: project.name,
          // The assignees are told "you"; the channel is read by everyone, so it names who was assigned.
          actionText: "assigned you to ticket",
          channelActionText: `assigned ${joinNames(newAssigneeIds.map(nameOf))} to ticket`,
          targetUserIds: newAssigneeIds,
          channelId: project.notificationChannelId,
          io: fastify.io,
        });
      }

      // Edited fields, or a column change made from the edit form (drag and drop has its own route above): tell the
      // people involved with the ticket (assignees, creator, watchers), except whoever just did it and anyone who
      // was just told they were assigned.
      if (hasEdits) {
        const stakeholders = new Set<string>([
          ...(updated.assigneeId ? [updated.assigneeId] : []),
          ...(Array.isArray(updated.assignees) ? (updated.assignees as any[]).map((a) => a?.uid) : []),
          ...(updated.createdById ? [updated.createdById] : []),
          ...(Array.isArray(updated.watchers) ? (updated.watchers as any[]).filter((w) => typeof w === "string") : []),
        ]);
        const targetUserIds = [...stakeholders].filter(
          (id) => id && id !== userId && !newAssigneeIds.includes(id),
        );
        await sendTicketBotNotification({
          workspaceId: project.workspaceId,
          actorName,
          ticketTitle: updated.title,
          projectName: project.name,
          actionText: editParts.join(" and "),
          targetUserIds,
          channelId: project.notificationChannelId,
          io: fastify.io,
          // An assignment in the same save already put its message in the channel
          postToChannel: newAssigneeIds.length === 0,
        });
      }

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.TICKET_UPDATE, updated);

      return reply.send(updated);
    },
  );

  // 11. Move Ticket (Drag & Drop column or reorder)
  fastify.patch(
    "/:projectId/tickets/:ticketId/move",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, ticketId } = request.params as {
        projectId: string;
        ticketId: string;
      };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const existingTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { column: true },
      });
      if (!existingTicket)
        return reply.status(404).send({ error: "Ticket not found" });

      const parseResult = moveTicketSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: parseResult.error.errors[0].message });
      }

      const { columnId: newColumnId, orderIndex: newOrderIndex } =
        parseResult.data;

      const targetColumn = await prisma.projectColumn.findFirst({
        where: { id: newColumnId, projectId },
      });
      if (!targetColumn)
        return reply.status(400).send({ error: "Target column not found" });

      const previousColumnId = existingTicket.columnId;
      const isColumnChanged = previousColumnId !== newColumnId;

      let updatedEvents = Array.isArray(existingTicket.events)
        ? [...(existingTicket.events as any[])]
        : [];

      if (isColumnChanged) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, username: true },
        });
        const actorName =
          actor?.displayName || actor?.username || "Team Member";

        const prevColName = existingTicket.column?.name || "status";
        updatedEvents.push({
          id: `evt-${Date.now()}-${updatedEvents.length}`,
          type: "status_change",
          action: `Status Change from ${prevColName} to ${targetColumn.name}`,
          user: actorName,
          date: new Date().toISOString(),
          color: "#10B981",
        });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          columnId: newColumnId,
          orderIndex: newOrderIndex,
          events: updatedEvents,
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
        const actorName = actor?.displayName || "A team member";

        const targetsToNotify: string[] = [];
        if (updated.assigneeId && updated.assigneeId !== userId) {
          targetsToNotify.push(updated.assigneeId);
        }
        if (
          updated.createdById &&
          updated.createdById !== userId &&
          updated.createdById !== updated.assigneeId
        ) {
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
      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.TICKET_MOVE, {
          ticket: updated,
          fromColumnId: previousColumnId,
          toColumnId: newColumnId,
          orderIndex: newOrderIndex,
          projectId,
        });

      return reply.send(updated);
    },
  );

  // 12. Delete Ticket
  fastify.delete(
    "/:projectId/tickets/:ticketId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, ticketId } = request.params as {
        projectId: string;
        ticketId: string;
      };
      const userId = (request.user as { id: string }).id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project)
        return reply.status(404).send({ error: "Project not found" });

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: project.workspaceId, userId },
        },
      });
      if (!membership) return reply.status(403).send({ error: "Unauthorized" });

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) return reply.status(404).send({ error: "Ticket not found" });

      await prisma.ticket.delete({ where: { id: ticketId } });

      fastify.io
        .to(`workspace:${project.workspaceId}`)
        .emit(SOCKET_EVENTS.TICKET_DELETE, {
          ticketId,
          projectId,
          columnId: ticket.columnId,
        });

      return reply.send({ success: true, message: "Ticket deleted" });
    },
  );

  // ==========================================
  // Document (Docs) Routes
  // ==========================================

  // 13. Public shareable document link endpoint
  fastify.get("/documents/share/:shareToken", async (request, reply) => {
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
      return reply
        .status(404)
        .send({ error: "Shared document not found or link is disabled" });
    }

    return reply.send(doc);
  });

  // Docs CRUD lives in routes/documents.ts (/api/documents) — docs are workspace-level.

  // --------------------------------------------------------------------------
  // TICKET COMMENTS & CHAT ENDPOINTS
  // --------------------------------------------------------------------------
  // List comments for a ticket
  fastify.get(
    "/:projectId/tickets/:ticketId/comments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, ticketId } = request.params as {
        projectId: string;
        ticketId: string;
      };
      const comments = await prisma.ticketComment.findMany({
        where: { ticketId },
        orderBy: { createdAt: "asc" },
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
      });
      return reply.send(comments);
    },
  );

  // Create comment on ticket
  fastify.post(
    "/:projectId/tickets/:ticketId/comments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, ticketId } = request.params as {
        projectId: string;
        ticketId: string;
      };
      const userId = (request.user as { id: string }).id;
      const { text, type, audioUrl, audioDuration } = request.body as any;

      if (!text && !audioUrl) {
        return reply
          .status(400)
          .send({ error: "Comment text or audio is required" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, username: true },
      });

      const comment = await prisma.ticketComment.create({
        data: {
          ticketId,
          userId,
          username: user?.displayName || user?.username || "Team Member",
          text: text || "",
          type: type || "text",
          audioUrl: audioUrl || null,
          audioDuration: audioDuration ? Number(audioDuration) : null,
        },
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
      });

      return reply.status(201).send(comment);
    },
  );

  // Toggle watcher on ticket
  fastify.post(
    "/:projectId/tickets/:ticketId/watch",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      const userId = (request.user as { id: string }).id;

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) return reply.status(404).send({ error: "Ticket not found" });

      let watchers = Array.isArray(ticket.watchers)
        ? (ticket.watchers as string[])
        : [];
      const isWatching = watchers.includes(userId);

      if (isWatching) {
        watchers = watchers.filter((id) => id !== userId);
      } else {
        watchers.push(userId);
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { watchers },
      });

      return reply.send({
        isWatching: !isWatching,
        watchers: updated.watchers,
      });
    },
  );
};
