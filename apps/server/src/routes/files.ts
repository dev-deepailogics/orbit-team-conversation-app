import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import path from 'path';
import { storageDriver, classifyFileType, formatBytes } from '../services/storage.js';
import { verifyChannelAccess } from '../utils/security.js';
import { audit } from '../services/audit.js';
import { canReadAttachment, canReadUntrackedFile, isSharedRecordingKey, resolveRequesterId } from '../services/fileAccess.js';

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

    // A channel named for the upload must belong to this workspace and be one the caller can use.
    if (channelId) {
      const channelAccess = await verifyChannelAccess(userId, channelId, reply);
      if (!channelAccess) return;
      if (channelAccess.channel.workspaceId !== workspaceId) {
        return reply.status(403).send({ error: 'That channel is not in this workspace' });
      }
    }
    // Uploading straight onto an existing message: the message must be in that channel.
    if (messageId) {
      const target = await prisma.message.findUnique({ where: { id: messageId }, select: { channelId: true } });
      if (!channelId || !target || target.channelId !== channelId) {
        return reply.status(403).send({ error: 'That message is not in this channel' });
      }
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

      // If a messageId is explicitly provided, insert Attachment record immediately;
      // otherwise, if the user is just staging/attaching the file in the composer,
      // return the file metadata and ONLY save it into the database when the message is sent.
      if (messageId) {
        const attachment = await prisma.attachment.create({
          data: {
            workspaceId,
            channelId: channelId || undefined,
            messageId,
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
        audit(request, { action: 'file.upload', actorId: userId, workspaceId, targetType: 'file', targetId: attachment.id, metadata: { fileName: originalFileName, fileType: mimeType, fileSize: uploadResult.fileSize, channelId: channelId || null } });
        return reply.status(201).send(attachment);
      }

      // Staged upload (the composer attaches it when the message is sent). It is recorded now, owned by the uploader,
      // so that only the uploader can attach it and access to it can be checked from the first moment.
      await prisma.attachment.create({
        data: {
          workspaceId,
          channelId: channelId || undefined,
          uploaderId: userId,
          fileName: originalFileName,
          fileKey: uploadResult.fileKey,
          fileUrl: uploadResult.fileUrl,
          fileType: mimeType,
          fileSize: uploadResult.fileSize,
          storageProvider: uploadResult.storageProvider,
        },
      });
      const uploader = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      audit(request, { action: 'file.upload', actorId: userId, workspaceId, targetType: 'file', metadata: { fileName: originalFileName, fileType: mimeType, fileSize: uploadResult.fileSize, channelId: channelId || null, staged: true } });
      return reply.status(200).send({
        workspaceId,
        channelId: channelId || undefined,
        uploaderId: userId,
        fileName: originalFileName,
        fileKey: uploadResult.fileKey,
        fileUrl: uploadResult.fileUrl,
        fileType: mimeType,
        fileSize: uploadResult.fileSize,
        storageProvider: uploadResult.storageProvider,
        uploader,
      });
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

    // The same stored file can have several records (e.g. a forwarded copy in another channel): any one that grants
    // access is enough. Records give the original filename and MIME type.
    const records = await prisma.attachment.findMany({
      where: { fileKey: rawKey, isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    const attachment = records[0] ?? null;

    let downloaderId: string | null = null;
    if (!(await isSharedRecordingKey(rawKey))) {
      const requesterId = await resolveRequesterId(fastify, request);
      if (!requesterId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const allowed = attachment
        ? (await Promise.all(records.map((r) => canReadAttachment(requesterId, r)))).some(Boolean)
        : await canReadUntrackedFile(requesterId, rawKey); // stored before uploads were recorded (see fileAccess.ts)
      if (!allowed) {
        audit(request, { action: 'file.download', outcome: 'failure', actorId: requesterId, workspaceId: attachment?.workspaceId, targetType: 'file', targetId: attachment?.id, metadata: { reason: 'no_access' } });
        return reply.status(403).send({ error: 'You do not have access to this file' });
      }
      downloaderId = requesterId;
    }

    // One entry per download: skip the follow-up range requests a video player makes while seeking/buffering.
    const firstRange = request.headers.range;
    if (!firstRange || /^bytes=0-/.test(firstRange)) {
      audit(request, { action: 'file.download', actorId: downloaderId, workspaceId: attachment?.workspaceId, targetType: 'file', targetId: attachment?.id, metadata: { fileName: attachment?.fileName ?? rawKey.split('/').pop(), fileSize: attachment?.fileSize, ...(downloaderId ? {} : { anonymous: true }) } });
    }

    const fileData = await storageDriver.getFileStream(rawKey);
    if (!fileData) {
      return reply.status(404).send({ error: 'File not found on storage server' });
    }

    const mimeType = attachment?.fileType || 'application/octet-stream';
    const originalName = attachment?.fileName || fileData.fileName || 'file';

    // Active content (HTML, SVG, XML, scripts) is never shown inline: served from our own origin it could run script
    // with the signed-in user's access. Browsers download it instead; images, video, audio, PDF and text still preview.
    const isActiveContent = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)\b/i.test(mimeType);
    const dispositionType = downloadQuery || isActiveContent ? 'attachment' : 'inline';
    // Clean ASCII fallback for `filename="..."` (HTTP headers forbid non-ASCII characters such as Unicode narrow no-break space U+8239 from macOS screenshots)
    const asciiSafeName = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const encodedName = encodeURIComponent(originalName);

    reply.header('Content-Type', mimeType);
    reply.header('Accept-Ranges', 'bytes');
    reply.header(
      'Content-Disposition',
      `${dispositionType}; filename="${asciiSafeName}"; filename*=UTF-8''${encodedName}`
    );
    // Private: shared caches and CDNs must not serve a protected file to someone who never authenticated.
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');

    // Handle HTTP Range requests (crucial for video playback like MP4, WebM, MOV in browsers)
    const rangeHeader = request.headers.range;
    const totalSize = fileData.size || 0;

    if (rangeHeader && rangeHeader.startsWith('bytes=') && totalSize > 0) {
      const parts = rangeHeader.slice(6).split('-');
      const startStr = parts[0];
      const endStr = parts[1];

      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (isNaN(start)) {
        start = totalSize - end;
        end = totalSize - 1;
      } else if (isNaN(end)) {
        end = totalSize - 1;
      }

      if (start >= 0 && start <= end && end < totalSize) {
        const chunkLength = end - start + 1;
        const rangeStream = await storageDriver.getFileStream(rawKey, { start, end });

        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        reply.header('Content-Length', chunkLength);

        return reply.send(rangeStream?.stream || fileData.stream);
      }
    }

    if (fileData.size) {
      reply.header('Content-Length', fileData.size);
    }

    return reply.send(fileData.stream);
  });

  // Legacy route support for /api/files/:filename. Same rules as the main download route: only recorded files, only
  // for people allowed to see them. (Loose files on disk with no database record are no longer served.)
  fastify.get('/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeFilename = path.basename(filename);

    const records = await prisma.attachment.findMany({
      where: {
        fileKey: { endsWith: '/' + safeFilename },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });
    const attachment = records[0];
    if (!attachment) {
      return reply.status(404).send({ error: 'File not found' });
    }

    if (!(await isSharedRecordingKey(attachment.fileKey))) {
      const requesterId = await resolveRequesterId(fastify, request);
      if (!requesterId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!(await Promise.all(records.map((r) => canReadAttachment(requesterId, r)))).some(Boolean)) {
        return reply.status(403).send({ error: 'You do not have access to this file' });
      }
    }

    const fileData = await storageDriver.getFileStream(attachment.fileKey);
    if (!fileData) {
      return reply.status(404).send({ error: 'File not found' });
    }
    reply.header('Content-Type', attachment.fileType);
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');
    return reply.send(fileData.stream);
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

    // Verify permission: Uploader OR Workspace Admin/Owner OR Super Admin
    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    const isSuperAdmin = callerUser?.systemRole === 'SUPER_ADMIN';
    const member = attachment.workspace?.members?.[0];
    const isOwnerOrAdmin = member?.role === 'OWNER' || member?.role === 'ADMIN';
    const isUploader = attachment.uploaderId === userId;

    if (!isUploader && !isOwnerOrAdmin && !isSuperAdmin) {
      return reply.status(403).send({ error: 'You do not have permission to delete this file' });
    }

    // 1. Delete from physical storage, unless another live record (a forwarded copy, a reused upload) still uses the file
    const stillUsed = await prisma.attachment.count({
      where: { fileKey: attachment.fileKey, isDeleted: false, id: { not: attachment.id } },
    });
    if (stillUsed === 0) {
      await storageDriver.deleteFile(attachment.fileKey);
    }
    audit(request, { action: 'file.delete', actorId: userId, workspaceId: attachment.workspaceId, targetType: 'file', targetId: attachment.id, metadata: { fileName: attachment.fileName } });

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
        // Files sent in messages, in channels this member can see (not private channels they are not in, not unsent uploads)
        messageId: { not: null },
        OR: [{ channelId: null }, { channel: { type: 'PUBLIC' } }, { channel: { members: { some: { userId } } } }],
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

    const access = await verifyChannelAccess(userId, channelId, reply);
    if (!access) return;

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
