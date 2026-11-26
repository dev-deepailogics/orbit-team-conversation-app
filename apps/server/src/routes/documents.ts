import { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "@orbit/db";
import { SOCKET_EVENTS } from "@orbit/types";
import { z } from "zod";
import { verifyWorkspaceMember } from "../utils/security.js";
import { storageDriver } from "../services/storage.js";

const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

// Docs are workspace-level. A doc may optionally be linked to a project (projectId), nothing more.
// A doc is either typed in the editor (content) or an uploaded PDF / Word file (attachmentId).

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const DOC_INCLUDE = {
  creator: { select: userSelect },
  shares: { include: { user: { select: userSelect } } },
  attachment: { select: { id: true, fileName: true, fileUrl: true, fileType: true, fileSize: true } },
} as const;

// Files that can be uploaded as a doc, by extension, with the MIME type the file is served with.
const UPLOADABLE_DOC_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const uploadFieldsSchema = z.object({
  workspaceId: z.string({ required_error: "workspaceId is required" }).min(1),
  projectId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(255).optional(),
  isPublicInProject: z.boolean().default(false),
});

const fileExtension = (fileName: string) => {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
};

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

  // Upload a PDF / Word file as a doc (multipart). Send the workspaceId/projectId/title fields BEFORE the file.
  fastify.post("/upload", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;

    let file;
    try {
      file = await request.file();
    } catch {
      return reply.status(400).send({ error: "Invalid upload" });
    }
    if (!file) return reply.status(400).send({ error: "No file provided" });

    const fieldValue = (name: string) => {
      const field = (file.fields as Record<string, any>)[name];
      return field && typeof field === "object" && "value" in field ? field.value || undefined : undefined;
    };
    const parsed = uploadFieldsSchema.safeParse({
      workspaceId: fieldValue("workspaceId"),
      projectId: fieldValue("projectId"),
      title: fieldValue("title"),
      isPublicInProject: fieldValue("isPublicInProject") === "true",
    });
    if (!parsed.success) {
      file.file.resume(); // drain the stream so the request can finish
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { workspaceId, projectId, isPublicInProject } = parsed.data;

    const fileName = file.filename || "document";
    const mimeType = UPLOADABLE_DOC_TYPES[fileExtension(fileName)];
    if (!mimeType) {
      file.file.resume();
      return reply.status(400).send({ error: "Only PDF and Word (.doc, .docx) files can be uploaded" });
    }

    if (!(await verifyWorkspaceMember(userId, workspaceId, reply))) {
      file.file.resume();
      return;
    }
    if (!(await checkProject(workspaceId, projectId, reply))) {
      file.file.resume();
      return;
    }

    let uploaded;
    try {
      uploaded = await storageDriver.uploadFile({ stream: file.file, fileName, mimeType, workspaceId });
    } catch (err: any) {
      if (err?.code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: "File is too large (max 50 MB)" });
      }
      fastify.log.error(err, "Failed to upload document file");
      return reply.status(500).send({ error: "Failed to upload file" });
    }

    const title = parsed.data.title || fileName.replace(/\.[^.]+$/, "") || "Untitled Document";
    const doc = await prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          workspaceId,
          uploaderId: userId,
          fileName,
          fileKey: uploaded.fileKey,
          fileUrl: uploaded.fileUrl,
          fileType: mimeType,
          fileSize: uploaded.fileSize,
          storageProvider: uploaded.storageProvider,
        },
      });
      return tx.projectDocument.create({
        data: {
          workspaceId,
          projectId: projectId || null,
          title: title.slice(0, 255),
          content: "",
          icon: mimeType === "application/pdf" ? "📕" : "📘",
          isPublicInProject,
          createdById: userId,
          attachmentId: attachment.id,
        },
        include: DOC_INCLUDE,
      });
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
    // An uploaded doc owns its file: remove the attachment and the stored file with it.
    if (doc.attachmentId) {
      const attachment = await prisma.attachment.update({
        where: { id: doc.attachmentId },
        data: { isDeleted: true },
        select: { fileKey: true },
      });
      storageDriver.deleteFile(attachment.fileKey).catch(() => {});
    }
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
