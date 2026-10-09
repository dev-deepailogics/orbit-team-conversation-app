import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import path from 'path';
import fs from 'fs';
import { storageDriver, classifyFileType, formatBytes } from '../services/storage.js';

export const fileRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Upload File with rich metadata
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file provided in multipart request' });
    }

    // Read fields if sent along with multipart or query
    const fields = (data.fields as { [key: string]: any }) || {};
    let workspaceId =
      (request.query as any)?.workspaceId ||
      fields.workspaceId?.value ||
      fields.workspaceId;

    const channelId =
      (request.query as any)?.channelId ||
      fields.channelId?.value ||
      fields.channelId ||
      null;

    const messageId =
      (request.query as any)?.messageId ||
      fields.messageId?.value ||
      fields.messageId ||
      null;

    // If workspaceId is not explicitly provided, try to find it via channelId
    if (!workspaceId && channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { workspaceId: true },
      });
      if (channel?.workspaceId) {
        workspaceId = channel.workspaceId;
      }
    }

    // If still not found, fallback to user's first/active workspace membership
    if (!workspaceId) {
      const memberRecord = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { workspaceId: true },
      });
      if (memberRecord?.workspaceId) {
        workspaceId = memberRecord.workspaceId;
      }
    }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required for file uploads' });
    }

    // Verify workspace membership
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

    try {
      const originalFileName = data.filename || 'attachment';
      const mimeType = data.mimetype || 'application/octet-stream';

      const uploadResult = await storageDriver.uploadFile({
        stream: data.file,
        fileName: originalFileName,
        mimeType,
        workspaceId,
        channelId: channelId || undefined,
      });

      // Insert Attachment record into DB with complete metadata
      const attachment = await prisma.attachment.create({
        data: {
          workspaceId,
          channelId: channelId || undefined,
          messageId: messageId || undefined,
          uploaderId: userId,
          fileName: originalFileName,
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.fileUrl,
          fileType: mimeType,
          fileSize: uploadResult.fileSize,
          storageProvider: uploadResult.storageProvider,
        },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      return reply.status(201).send(attachment);
    } catch (err) {
      fastify.log.error(err, 'Failed to upload file');
      return reply.status(500).send({ error: 'Failed to process file upload' });
    }
  });

  // 2. Download / View File by Key or ID
  fastify.get('/download/*', async (request, reply) => {
    const rawKey = (request.params as any)['*'];
    if (!rawKey) {
      return reply.status(400).send({ error: 'File path key is required' });
    }

    const downloadQuery = (request.query as any)?.download === '1' || (request.query as any)?.download === 'true';

    // Locate Attachment in DB to retrieve original filename & MIME type
    const attachment = await prisma.attachment.findFirst({
      where: {
        fileKey: rawKey,
        isDeleted: false,
      },
    });

    const fileData = await storageDriver.getFileStream(rawKey);
    if (!fileData) {
      return reply.status(404).send({ error: 'File not found on storage server' });
    }

    const mimeType = attachment?.fileType || 'application/octet-stream';
    const originalName = attachment?.fileName || fileData.fileName || 'file';

    const dispositionType = downloadQuery ? 'attachment' : 'inline';
    const encodedName = encodeURIComponent(originalName);

    reply.header('Content-Type', mimeType);
    if (fileData.size) {
      reply.header('Content-Length', fileData.size);
    }
    reply.header(
      'Content-Disposition',
      `${dispositionType}; filename="${originalName.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`
    );
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');

    return reply.send(fileData.stream);
  });

  // Legacy route support for /api/files/:filename
  fastify.get('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    const directPath = path.join(uploadDir, filename);

    if (fs.existsSync(directPath)) {
      const stream = fs.createReadStream(directPath);
      return reply.send(stream);
    }

    // Try finding by fileKey ending with filename
    const attachment = await prisma.attachment.findFirst({
      where: {
        fileKey: { endsWith: filename },
        isDeleted: false,
      },
    });

    if (attachment) {
      const fileData = await storageDriver.getFileStream(attachment.fileKey);
      if (fileData) {
        reply.header('Content-Type', attachment.fileType);
        return reply.send(fileData.stream);
      }
    }

    return reply.status(404).send({ error: 'File not found' });
  });

  // 3. Delete File from server & database
  fastify.delete('/:fileId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request.user as { id: string }).id;

    const attachment = await prisma.attachment.findUnique({
      where: { id: fileId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!attachment) {
      return reply.status(404).send({ error: 'File attachment not found' });
    }

    // Verify permission: Uploader OR Workspace Admin/Owner
    const member = attachment.workspace?.members?.[0];
    const isOwnerOrAdmin = member?.role === 'OWNER' || member?.role === 'ADMIN';
    const isUploader = attachment.uploaderId === userId;

    if (!isUploader && !isOwnerOrAdmin) {
      return reply.status(403).send({ error: 'You do not have permission to delete this file' });
    }

    // 1. Delete from physical storage
    await storageDriver.deleteFile(attachment.fileKey);

    // 2. Mark deleted in database
    await prisma.attachment.update({
      where: { id: fileId },
      data: { isDeleted: true },
    });

    // 3. Notify real-time clients
    if (fastify.io) {
      const payload = {
        fileId: attachment.id,
        messageId: attachment.messageId,
        channelId: attachment.channelId,
        workspaceId: attachment.workspaceId,
      };

      if (attachment.channelId) {
        fastify.io.to(`channel:${attachment.channelId}`).emit(SOCKET_EVENTS.FILE_DELETE, payload);
      }
      fastify.io.to(`workspace:${attachment.workspaceId}`).emit(SOCKET_EVENTS.FILE_DELETE, payload);
    }

    return reply.send({ success: true, fileId: attachment.id });
  });

  // 4. Get Workspace Storage Stats
  fastify.get('/workspaces/:workspaceId/storage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userId = (request.user as { id: string }).id;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      return reply.status(403).send({ error: 'You are not a member of this workspace' });
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        workspaceId,
        isDeleted: false,
      },
      include: {
        uploader: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        channel: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalBytes = 0;
    const categoryTotals: { [cat: string]: { bytes: number; count: number; color: string; label: string } } = {
      images: { bytes: 0, count: 0, color: '#36C5F0', label: 'Images' },
      videos: { bytes: 0, count: 0, color: '#E01E5A', label: 'Videos' },
      audio: { bytes: 0, count: 0, color: '#ECB22E', label: 'Audio' },
      documents: { bytes: 0, count: 0, color: '#2EB67D', label: 'Documents & PDFs' },
      archives: { bytes: 0, count: 0, color: '#8B5CF6', label: 'Archives (ZIP/TAR)' },
      code: { bytes: 0, count: 0, color: '#F97316', label: 'Code & Scripts' },
      other: { bytes: 0, count: 0, color: '#64748B', label: 'Other Files' },
    };

    attachments.forEach((att) => {
      const size = Number(att.fileSize) || 0;
      totalBytes += size;
      const cat = classifyFileType(att.fileType, att.fileName);
      if (categoryTotals[cat]) {
        categoryTotals[cat].bytes += size;
        categoryTotals[cat].count += 1;
      } else {
        categoryTotals.other.bytes += size;
        categoryTotals.other.count += 1;
      }
    });

    const categories = Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      label: data.label,
      bytes: data.bytes,
      count: data.count,
      color: data.color,
    }));

    return reply.send({
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
      fileCount: attachments.length,
      categories,
      recentFiles: attachments.slice(0, 30),
    });
  });

  // 5. Get Channel Storage Stats & File List
  fastify.get('/channels/:channelId/storage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const userId = (request.user as { id: string }).id;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' });
    }

    if (channel.type !== 'PUBLIC') {
      const isMember = channel.members.some((m) => m.userId === userId);
      if (!isMember) {
        return reply.status(403).send({ error: 'You are not a member of this channel' });
      }
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        channelId,
        isDeleted: false,
      },
      include: {
        uploader: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalBytes = 0;
    const categoryTotals: { [cat: string]: { bytes: number; count: number; color: string; label: string } } = {
      images: { bytes: 0, count: 0, color: '#36C5F0', label: 'Images' },
      videos: { bytes: 0, count: 0, color: '#E01E5A', label: 'Videos' },
      audio: { bytes: 0, count: 0, color: '#ECB22E', label: 'Audio' },
      documents: { bytes: 0, count: 0, color: '#2EB67D', label: 'Documents & PDFs' },
      archives: { bytes: 0, count: 0, color: '#8B5CF6', label: 'Archives' },
      code: { bytes: 0, count: 0, color: '#F97316', label: 'Code & Scripts' },
      other: { bytes: 0, count: 0, color: '#64748B', label: 'Other' },
    };

    attachments.forEach((att) => {
      const size = Number(att.fileSize) || 0;
      totalBytes += size;
      const cat = classifyFileType(att.fileType, att.fileName);
      if (categoryTotals[cat]) {
        categoryTotals[cat].bytes += size;
        categoryTotals[cat].count += 1;
      } else {
        categoryTotals.other.bytes += size;
        categoryTotals.other.count += 1;
      }
    });

    const categories = Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      label: data.label,
      bytes: data.bytes,
      count: data.count,
      color: data.color,
    }));

    return reply.send({
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
      fileCount: attachments.length,
      categories,
      files: attachments,
    });
  });
};
