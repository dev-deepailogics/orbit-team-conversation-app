import { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "@orbit/db";
import { SOCKET_EVENTS } from "@orbit/types";
import { z } from "zod";
import { verifyWorkspaceMember } from "../utils/security.js";

const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

// Docs are workspace-level. A doc may optionally be linked to a project (projectId), nothing more.

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const DOC_INCLUDE = {
  creator: { select: userSelect },
  shares: { include: { user: { select: userSelect } } },
} as const;

const createDocumentSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional().nullable(),
  title: z.string().min(1).max(255).default("Untitled Document"),
  content: z.string().default(""),
  icon: z.string().optional().default("📄"),
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
  projectId: z.string().min(1).optional().nullable(),
});

const shareDocumentSchema = z.object({
  userId: userIdSchema,
  permission: z.enum(["VIEW", "EDIT"]).default("EDIT"),
});

async function checkProject(workspaceId: string, projectId: string | null | undefined, reply: FastifyReply) {
  if (!projectId) return true;
  const pr = await prisma.project.findUnique({ where: { id: projectId }, select: { workspaceId: true } });
  if (!pr || pr.workspaceId !== workspaceId) {
    reply.status(400).send({ error: "Invalid project" });
    return false;
  }
  return true;
}

// Loads a doc and the caller's workspace access. isAdmin = workspace OWNER/ADMIN or super admin.
async function loadDoc(userId: string, documentId: string, reply: FastifyReply) {
  const doc = await prisma.projectDocument.findUnique({ where: { id: documentId }, include: { shares: true } });
  if (!doc) {
    reply.status(404).send({ error: "Document not found" });
    return null;
  }
  const access = await verifyWorkspaceMember(userId, doc.workspaceId, reply);
  if (!access) return null;
  const isAdmin = access.isSuperAdmin || ["OWNER", "ADMIN"].includes(access.workspaceMember?.role);
  return { doc, isAdmin, isCreator: doc.createdById === userId };
}

export async function documentRoutes(fastify: FastifyInstance) {
  const emit = (workspaceId: string, event: string, payload: unknown) =>
    fastify.io.to(`workspace:${workspaceId}`).emit(event, payload);

  // List docs in a workspace (optionally only those linked to a project). Visible if public, mine, or shared with me.
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { workspaceId, projectId } = request.query as { workspaceId?: string; projectId?: string };
    if (!workspaceId) return reply.status(400).send({ error: "workspaceId is required" });
    if (!(await verifyWorkspaceMember(userId, workspaceId, reply))) return;

    return prisma.projectDocument.findMany({
      where: {
        workspaceId,
        ...(projectId && { projectId }),
        OR: [{ isPublicInProject: true }, { createdById: userId }, { shares: { some: { userId } } }],
      },
      include: DOC_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  });

  fastify.post("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const parsed = createDocumentSchema.safeParse(request.body || {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { workspaceId, projectId, title, content, icon, coverImage, isPublicInProject } = parsed.data;

    if (!(await verifyWorkspaceMember(userId, workspaceId, reply))) return;
    if (!(await checkProject(workspaceId, projectId, reply))) return;

    const doc = await prisma.projectDocument.create({
      data: {
        workspaceId,
        projectId: projectId || null,
        title: title || "Untitled Document",
        content: content || "",
        icon: icon || "📄",
        coverImage: coverImage || null,
        isPublicInProject: isPublicInProject ?? false,
        createdById: userId,
      },
      include: DOC_INCLUDE,
    });
    emit(workspaceId, SOCKET_EVENTS.DOCUMENT_NEW, doc);
    return reply.status(201).send(doc);
  });

  fastify.get("/:documentId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { documentId } = request.params as { documentId: string };
    const loaded = await loadDoc(userId, documentId, reply);
    if (!loaded) return;
    const { doc, isCreator } = loaded;
    if (!isCreator && !doc.isPublicInProject && !doc.shares.some((s) => s.userId === userId)) {
      return reply.status(403).send({ error: "You do not have permission to view this document" });
    }
    return prisma.projectDocument.findUnique({ where: { id: documentId }, include: DOC_INCLUDE });
  });

  fastify.patch("/:documentId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { documentId } = request.params as { documentId: string };
    const loaded = await loadDoc(userId, documentId, reply);
    if (!loaded) return;
    const { doc, isAdmin, isCreator } = loaded;

    const hasEditShare = doc.shares.some((s) => s.userId === userId && s.permission === "EDIT");
    if (!isCreator && !isAdmin && !hasEditShare && !doc.isPublicInProject) {
      return reply.status(403).send({ error: "You do not have permission to edit this document" });
    }

    const parsed = updateDocumentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { isPublicInProject, isPublicLinkEnabled, projectId, ...rest } = parsed.data;

    if ((isPublicInProject !== undefined || isPublicLinkEnabled !== undefined) && !isCreator && !isAdmin) {
      return reply.status(403).send({ error: "Only the document creator or admin can change sharing settings" });
    }
    if (projectId !== undefined && !(await checkProject(doc.workspaceId, projectId, reply))) return;

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) data[k] = v;
    if (isPublicInProject !== undefined) data.isPublicInProject = isPublicInProject;
    if (isPublicLinkEnabled !== undefined) data.isPublicLinkEnabled = isPublicLinkEnabled;
    if (projectId !== undefined) data.projectId = projectId;

    const updated = await prisma.projectDocument.update({ where: { id: documentId }, data, include: DOC_INCLUDE });
    emit(doc.workspaceId, SOCKET_EVENTS.DOCUMENT_UPDATE, updated);
    return updated;
  });

  fastify.delete("/:documentId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { documentId } = request.params as { documentId: string };
    const loaded = await loadDoc(userId, documentId, reply);
    if (!loaded) return;
    const { doc, isAdmin, isCreator } = loaded;
    if (!isCreator && !isAdmin) {
      return reply.status(403).send({ error: "Only the creator or workspace admin can delete this document" });
    }
    await prisma.projectDocument.delete({ where: { id: documentId } });
    emit(doc.workspaceId, SOCKET_EVENTS.DOCUMENT_DELETE, { documentId, workspaceId: doc.workspaceId });
    return { success: true, message: "Document deleted" };
  });

  // Add or update a user share
  fastify.post("/:documentId/shares", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { documentId } = request.params as { documentId: string };
    const loaded = await loadDoc(userId, documentId, reply);
    if (!loaded) return;
    const { doc, isAdmin, isCreator } = loaded;
    if (!isCreator && !isAdmin) {
      return reply.status(403).send({ error: "Only the creator or admin can manage document sharing" });
    }

    const parsed = shareDocumentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });
    const { userId: targetUserId, permission } = parsed.data;

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId: targetUserId } },
    });
    if (!targetMember) return reply.status(400).send({ error: "Selected user is not a member of this workspace" });

    await prisma.projectDocumentShare.upsert({
      where: { documentId_userId: { documentId, userId: targetUserId } },
      update: { permission },
      create: { documentId, userId: targetUserId, permission },
    });
    const updated = await prisma.projectDocument.findUnique({ where: { id: documentId }, include: DOC_INCLUDE });
    emit(doc.workspaceId, SOCKET_EVENTS.DOCUMENT_UPDATE, updated);
    return updated;
  });

  // Remove a user share (owner/admin, or the user removing themselves)
  fastify.delete("/:documentId/shares/:targetUserId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const { documentId, targetUserId } = request.params as { documentId: string; targetUserId: string };
    const loaded = await loadDoc(userId, documentId, reply);
    if (!loaded) return;
    const { doc, isAdmin, isCreator } = loaded;
    if (!isCreator && !isAdmin && userId !== targetUserId) {
      return reply.status(403).send({ error: "Unauthorized to remove this share" });
    }
    await prisma.projectDocumentShare.deleteMany({ where: { documentId, userId: targetUserId } });
    const updated = await prisma.projectDocument.findUnique({ where: { id: documentId }, include: DOC_INCLUDE });
    emit(doc.workspaceId, SOCKET_EVENTS.DOCUMENT_UPDATE, updated);
    return updated;
  });
}
