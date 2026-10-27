import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@orbit/db';
import {
  getOAuthClient,
  getAuthenticatedDrive,
  getGoogleAuthErrorPayload,
  getConfiguredRootFolderIds,
  getGoogleApiErrorMessage,
  GOOGLE_DRIVE_RECONNECT_MESSAGE,
} from '../services/driveAuth.js';

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export const driveRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------
  // 1. Google OAuth Endpoints
  // -------------------------------------------------------------

  // GET /api/google/auth - Generate consent URL
  fastify.get('/google/auth', async (request, reply) => {
    const oauth2Client = getOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      login_hint: 'affansidd1030@gmail.com',
      scope: ['https://www.googleapis.com/auth/drive'],
    });

    return reply.redirect(url);
  });

  // GET /api/google/callback - Exchange code for tokens
  fastify.get('/google/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: 'Missing code' });
    }

    try {
      const oauth2Client = getOAuthClient();
      const tokenResponse = await oauth2Client.getToken(code);
      const tokens = tokenResponse.tokens;

      oauth2Client.setCredentials(tokens);
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Verify email matches affansidd1030@gmail.com
      const about = await drive.about.get({ fields: 'user(emailAddress)' });
      const authedEmail = about.data.user?.emailAddress?.toLowerCase();
      const requiredEmail = (process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL || 'affansidd1030@gmail.com').toLowerCase();

      if (authedEmail && authedEmail !== requiredEmail) {
        return reply.status(403).send({
          error: `Invalid Google Account. Please sign in with ${requiredEmail} (attempted with ${authedEmail}).`,
        });
      }

      await prisma.googleOAuth.upsert({
        where: { id: 'google_oauth' },
        update: {
          tokens: tokens as any,
        },
        create: {
          id: 'google_oauth',
          tokens: tokens as any,
        },
      });

      // Automatically initialize root folder on the connected account's drive
      try {
        oauth2Client.setCredentials(tokens);
        const { google } = await import('googleapis');
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // Look for existing "Orbit Projects Media" folder
        const existing = await drive.files.list({
          q: "name = 'Orbit Projects Media' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id, name)',
          spaces: 'drive',
        });

        let rootId = existing.data.files?.[0]?.id;
        if (!rootId) {
          const created = await drive.files.create({
            requestBody: {
              name: 'Orbit Projects Media',
              mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id, name',
          });
          rootId = created.data.id || undefined;
        }

        if (rootId) {
          (tokens as any).rootFolderId = rootId;
          await prisma.googleOAuth.update({
            where: { id: 'google_oauth' },
            data: { tokens: tokens as any },
          });
        }
      } catch (rootInitErr) {
        console.warn('Could not auto-create root folder on drive:', rootInitErr);
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      return reply.redirect(`${clientUrl}?media_connected=true`);
    } catch (error: any) {
      return reply.status(502).send({
        error: 'Google OAuth code exchange failed',
        details: error?.message || 'Unable to exchange authorization code',
      });
    }
  });

  // GET /api/google/status - Connection status check
  fastify.get('/google/status', async (request, reply) => {
    try {
      const authResult = await getAuthenticatedDrive();

      if ('error' in authResult) {
        return reply.send({
          connected: false,
          error: authResult.error,
          ...(authResult.requiresReconnect && {
            code: authResult.code,
            requiresReconnect: true,
          }),
        });
      }

      const about = await authResult.drive.about.get({ fields: 'user(emailAddress,displayName,photoLink)' });

      return reply.send({
        connected: true,
        email: about.data.user?.emailAddress || null,
        displayName: about.data.user?.displayName || null,
        photoLink: about.data.user?.photoLink || null,
        hasAccessToken: Boolean(authResult.auth.credentials.access_token),
        expiresAt: authResult.auth.credentials.expiry_date || null,
        updatedAt: authResult.updatedAt || null,
      });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) {
        return reply.send({ connected: false, ...authError });
      }

      return reply.status(503).send({
        error: 'Unable to check Google Drive connection. Please try again.',
      });
    }
  });

  // DELETE /api/google/disconnect - Disconnect Google Drive
  fastify.delete('/google/disconnect', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, role: true },
    });

    const isAdmin = user?.systemRole === 'SUPER_ADMIN' || user?.systemRole === 'WORKSPACE_ADMIN' || user?.role === 'admin';
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Only admins can disconnect Google Drive' });
    }

    await prisma.googleOAuth.deleteMany({
      where: { id: 'google_oauth' },
    });

    return reply.send({ success: true });
  });

  // -------------------------------------------------------------
  // 2. Upload Sessions (Resumable 16MB Chunk Loop)
  // -------------------------------------------------------------

  // POST /api/upload/session - Create resumable upload session
  fastify.post('/upload/session', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const requestedFolderId = (body?.folderId || '').trim();
      const projectId = (body?.projectId || '').trim();
      const projectTitle = (body?.projectTitle || '').trim();
      const originalFileName = (body?.fileName || '').trim().replace(/\s+/g, ' ');
      const fileNamePrefix = (body?.fileNamePrefix || '').trim().replace(/\s+/g, ' ');
      const description = (body?.description || '').trim();
      const mimeType = (body?.mimeType || '').trim() || 'application/octet-stream';
      const size = Number(body?.size || 0);

      if (!originalFileName) {
        return reply.status(400).send({ error: 'File name missing' });
      }

      if (!Number.isFinite(size) || size <= 0) {
        return reply.status(400).send({ error: 'File size missing' });
      }

      const folderId = requestedFolderId || getConfiguredRootFolderIds()[0] || '';
      if (!folderId) {
        return reply.status(500).send({ error: 'Folder ID missing' });
      }

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }

      const { drive, auth } = authResult;
      const rootFolderIds = getConfiguredRootFolderIds();
      const driveRootId = rootFolderIds[0] || 'root';

      let resolvedFolderId = folderId;
      const accountRootId = (authResult as any).tokens?.rootFolderId || driveRootId;
      if (resolvedFolderId === 'root' || !resolvedFolderId) {
        resolvedFolderId = accountRootId;
      }

      let targetFolderMime = 'application/vnd.google-apps.folder';
      if (resolvedFolderId && resolvedFolderId !== 'root') {
        try {
          const targetFolder = await drive.files.get({
            fileId: resolvedFolderId,
            fields: 'id, name, mimeType',
            supportsAllDrives: true,
          });
          targetFolderMime = targetFolder.data.mimeType;
        } catch (folderFetchErr: any) {
          console.warn('Could not fetch target folder, falling back to root folder:', folderFetchErr.message);
          resolvedFolderId = 'root';
        }
      }

      if (targetFolderMime !== 'application/vnd.google-apps.folder') {
        return reply.status(400).send({ error: 'Selected target is not a Google Drive folder' });
      }

      const accessTokenResult = await auth.getAccessToken();
      const accessToken = typeof accessTokenResult === 'string' ? accessTokenResult : accessTokenResult?.token;

      if (!accessToken) {
        return reply.status(401).send({ error: 'Google Drive access token missing. Reconnect Google Drive.' });
      }

      const uploadFileName = fileNamePrefix ? `${fileNamePrefix}_${originalFileName}` : originalFileName;
      const uploadUrl = new URL('https://www.googleapis.com/upload/drive/v3/files');
      uploadUrl.searchParams.set('uploadType', 'resumable');
      uploadUrl.searchParams.set('supportsAllDrives', 'true');
      uploadUrl.searchParams.set('fields', 'id,name,mimeType,size,modifiedTime,webViewLink');

      const origin = (request.headers.origin as string) || (request.headers.referer as string) || '';

      const parents = resolvedFolderId && resolvedFolderId !== 'root' ? [resolvedFolderId] : [];

      const response = await fetch(uploadUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(size),
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({
          name: uploadFileName,
          description,
          ...(parents.length > 0 ? { parents } : {}),
          appProperties: {
            projectId,
            projectTitle,
            folderId: resolvedFolderId || 'root',
            originalFileName,
            fileNamePrefix,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return reply.status(401).send({
            error: GOOGLE_DRIVE_RECONNECT_MESSAGE,
            code: 'GOOGLE_DRIVE_AUTH_EXPIRED',
            requiresReconnect: true,
          });
        }
        const errText = await response.text();
        return reply.status(response.status).send({ error: errText || 'Google Drive upload session failed' });
      }

      const sessionUrl = response.headers.get('location');
      if (!sessionUrl) {
        return reply.status(502).send({ error: 'Google Drive did not return a resumable session URL' });
      }

      return reply.send({
        sessionUrl,
        fileName: uploadFileName,
        originalFileName,
        fileNamePrefix,
        folderId: resolvedFolderId,
        size,
        mimeType,
      });
    } catch (error: any) {
      console.error('Upload session error details:', error);
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) {
        return reply.status(401).send(authError);
      }
      return reply.status(500).send({ error: error.message || 'Upload session could not be created' });
    }
  });

  // POST /api/upload/complete - Finalize upload and store metadata
  fastify.post('/upload/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const fileId = (body?.fileId || '').trim();
      const folderId = (body?.folderId || '').trim();
      const projectId = (body?.projectId || '').trim();
      const projectTitle = (body?.projectTitle || '').trim();
      const originalFileName = (body?.originalFileName || '').trim().replace(/\s+/g, ' ');
      const fileNamePrefix = (body?.fileNamePrefix || '').trim().replace(/\s+/g, ' ');
      const description = (body?.description || '').trim();

      if (!fileId) return reply.status(400).send({ error: 'File ID missing' });
      if (!folderId) return reply.status(400).send({ error: 'Folder ID missing' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }

      const { drive } = authResult;
      const driveFile = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, webViewLink, parents',
        supportsAllDrives: true,
      });

      const fileData = driveFile.data;
      const resolvedSize = fileData.size ? BigInt(fileData.size) : null;
      const resolvedModified = fileData.modifiedTime ? new Date(fileData.modifiedTime) : new Date();

      const savedFile = await prisma.mediaFile.upsert({
        where: { id: fileId },
        update: {
          name: fileData.name || originalFileName,
          originalFileName: originalFileName || fileData.name || '',
          fileNamePrefix: fileNamePrefix || null,
          description: description || null,
          mimeType: fileData.mimeType || 'application/octet-stream',
          size: resolvedSize,
          webViewLink: fileData.webViewLink || null,
          folderId,
          projectId,
          projectTitle: projectTitle || null,
          modifiedTime: resolvedModified,
        },
        create: {
          id: fileId,
          name: fileData.name || originalFileName,
          originalFileName: originalFileName || fileData.name || '',
          fileNamePrefix: fileNamePrefix || null,
          description: description || null,
          mimeType: fileData.mimeType || 'application/octet-stream',
          size: resolvedSize,
          webViewLink: fileData.webViewLink || null,
          folderId,
          projectId,
          projectTitle: projectTitle || null,
          shareAccess: 'linkReady',
          modifiedTime: resolvedModified,
        },
      });

      return reply.send({
        success: true,
        file: {
          ...savedFile,
          size: savedFile.size ? savedFile.size.toString() : '0',
        },
      });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Upload could not be finalized' });
    }
  });

  // -------------------------------------------------------------
  // 3. Folder Management (/api/drive/folders)
  // -------------------------------------------------------------

  // GET /api/drive/folders
  fastify.get('/drive/folders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const projectId = (query?.projectId || '').trim();
      const projectTitle = (query?.projectTitle || '').trim();
      const parentId = (query?.parentId || '').trim();

      if (!projectId) {
        return reply.status(400).send({ error: 'Project ID missing' });
      }

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }

      const { drive } = authResult;
      const rootFolderIds = getConfiguredRootFolderIds();
      const driveRootId = rootFolderIds[0] || 'root';

      // 1. Ensure project root folder exists
      let projectRoot = await prisma.mediaFolder.findFirst({
        where: { projectId, isProjectRoot: true },
      });

      if (!projectRoot) {
        // Resolve project name
        let folderName = projectTitle;
        if (!folderName) {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true },
          });
          folderName = project?.name || `Project_${projectId.slice(0, 8)}`;
        }

        // Check if folder exists in Google Drive under root
        const queryStr = `'${driveRootId}' in parents and name = '${escapeDriveQueryValue(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const existingDriveFolders = await drive.files.list({
          q: queryStr,
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        let driveFolder = existingDriveFolders.data.files?.[0];

        if (!driveFolder) {
          const created = await drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [driveRootId],
            },
            fields: 'id, name, webViewLink',
            supportsAllDrives: true,
          });
          driveFolder = created.data;
        }

        projectRoot = await prisma.mediaFolder.create({
          data: {
            folderId: driveFolder.id!,
            name: driveFolder.name || folderName,
            projectId,
            parentId: driveRootId,
            isProjectRoot: true,
            webViewLink: driveFolder.webViewLink || null,
          },
        });
      }

      const currentParentId = parentId || projectRoot.folderId;

      // List subfolders from Drive
      const listRes = await drive.files.list({
        q: `'${currentParentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const folders = (listRes.data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink || null,
      }));

      return reply.send({
        projectRoot: {
          id: projectRoot.folderId,
          name: projectRoot.name,
          webViewLink: projectRoot.webViewLink,
        },
        currentFolderId: currentParentId,
        folders,
      });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to load folders' });
    }
  });

  // POST /api/drive/folders - Create subfolder
  fastify.post('/drive/folders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const projectId = (body?.projectId || '').trim();
      const parentId = (body?.parentId || '').trim();
      const name = (body?.name || '').trim().replace(/\s+/g, ' ');

      if (!name) return reply.status(400).send({ error: 'Folder name is required' });
      if (!parentId) return reply.status(400).send({ error: 'Parent folder ID missing' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      const { drive } = authResult;
      const created = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      const driveFolder = created.data;

      const saved = await prisma.mediaFolder.create({
        data: {
          folderId: driveFolder.id!,
          name: driveFolder.name || name,
          projectId,
          parentId,
          isProjectRoot: false,
          webViewLink: driveFolder.webViewLink || null,
        },
      });

      return reply.status(201).send({
        success: true,
        folder: {
          id: saved.folderId,
          name: saved.name,
          webViewLink: saved.webViewLink,
        },
      });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to create folder' });
    }
  });

  // PATCH /api/drive/folders - Rename folder
  fastify.patch('/drive/folders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const folderId = (body?.folderId || '').trim();
      const name = (body?.name || '').trim().replace(/\s+/g, ' ');

      if (!folderId || !name) return reply.status(400).send({ error: 'folderId and name required' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      await authResult.drive.files.update({
        fileId: folderId,
        requestBody: { name },
        supportsAllDrives: true,
      });

      await prisma.mediaFolder.updateMany({
        where: { folderId },
        data: { name },
      });

      return reply.send({ success: true, folderId, name });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to rename folder' });
    }
  });

  // DELETE /api/drive/folders - Delete folder
  fastify.delete('/drive/folders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const folderId = (query?.folderId || '').trim();

      if (!folderId) return reply.status(400).send({ error: 'folderId required' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      await authResult.drive.files.delete({
        fileId: folderId,
        supportsAllDrives: true,
      });

      await prisma.mediaFolder.deleteMany({
        where: { folderId },
      });

      return reply.send({ success: true, folderId });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to delete folder' });
    }
  });

  // -------------------------------------------------------------
  // 4. File Actions (/api/drive/files)
  // -------------------------------------------------------------

  // GET /api/drive/files - List files in folder
  fastify.get('/drive/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const folderId = (query?.folderId || '').trim();

      if (!folderId) return reply.send({ files: [] });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      const driveRes = await authResult.drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)',
        orderBy: 'modifiedTime desc,name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const driveFiles = driveRes.data.files || [];
      const fileIds = driveFiles.map((f: any) => f.id);

      const dbFiles = await prisma.mediaFile.findMany({
        where: { id: { in: fileIds } },
      });

      const dbMap = new Map(dbFiles.map((f) => [f.id, f]));

      const files = driveFiles.map((df: any) => {
        const stored = dbMap.get(df.id);
        return {
          id: df.id,
          name: df.name,
          originalFileName: stored?.originalFileName || df.name,
          fileNamePrefix: stored?.fileNamePrefix || '',
          description: stored?.description || '',
          mimeType: df.mimeType,
          size: df.size || (stored?.size ? stored.size.toString() : '0'),
          modifiedTime: df.modifiedTime,
          thumbnailLink: df.thumbnailLink || null,
          webViewLink: df.webViewLink || null,
          shareAccess: stored?.shareAccess || 'linkReady',
        };
      });

      return reply.send({ files });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to load files' });
    }
  });

  // PATCH /api/drive/files - Rename file
  fastify.patch('/drive/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const fileId = (body?.fileId || '').trim();
      const name = (body?.name || '').trim().replace(/\s+/g, ' ');

      if (!fileId || !name) return reply.status(400).send({ error: 'fileId and name required' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      await authResult.drive.files.update({
        fileId,
        requestBody: { name },
        supportsAllDrives: true,
      });

      await prisma.mediaFile.updateMany({
        where: { id: fileId },
        data: { name },
      });

      return reply.send({ success: true, fileId, name });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to rename file' });
    }
  });

  // DELETE /api/drive/files - Delete file
  fastify.delete('/drive/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const fileId = (query?.fileId || '').trim();

      if (!fileId) return reply.status(400).send({ error: 'fileId required' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      await authResult.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });

      await prisma.mediaFile.deleteMany({
        where: { id: fileId },
      });

      return reply.send({ success: true, fileId });
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to delete file' });
    }
  });

  // POST /api/drive/files/share - Toggle share access (anyone vs restricted)
  fastify.post('/drive/files/share', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = request.body as any;
      const fileId = (body?.fileId || '').trim();
      const action = (body?.action || 'linkReady').trim(); // 'linkReady' | 'restricted'

      if (!fileId) return reply.status(400).send({ error: 'fileId is required' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      const { drive } = authResult;

      const permsRes = await drive.permissions.list({
        fileId,
        fields: 'permissions(id,type,role)',
        supportsAllDrives: true,
      });

      const existingAnyone = (permsRes.data.permissions || []).find((p: any) => p.type === 'anyone');

      if (action === 'restricted') {
        if (existingAnyone) {
          await drive.permissions.delete({
            fileId,
            permissionId: existingAnyone.id!,
            supportsAllDrives: true,
          });
        }
        await prisma.mediaFile.updateMany({
          where: { id: fileId },
          data: { shareAccess: 'restricted' },
        });
        return reply.send({ success: true, shareAccess: 'restricted' });
      } else {
        // Link Ready
        if (!existingAnyone) {
          await drive.permissions.create({
            fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
          });
        }

        const driveFile = await drive.files.get({
          fileId,
          fields: 'webViewLink',
          supportsAllDrives: true,
        });

        await prisma.mediaFile.updateMany({
          where: { id: fileId },
          data: { shareAccess: 'linkReady' },
        });

        return reply.send({
          success: true,
          shareAccess: 'linkReady',
          link: driveFile.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        });
      }
    } catch (error: any) {
      const authError = getGoogleAuthErrorPayload(error);
      if (authError) return reply.status(401).send(authError);
      return reply.status(500).send({ error: error.message || 'Failed to update share permissions' });
    }
  });

  // GET /api/drive/files/content - Stream file proxy with HTTP range support
  fastify.get('/drive/files/content', async (request, reply) => {
    try {
      const query = request.query as any;
      const fileId = (query?.fileId || '').trim();

      if (!fileId) return reply.status(400).send({ error: 'fileId missing' });

      const authResult = await getAuthenticatedDrive();
      if ('error' in authResult) return reply.status(authResult.status).send({ error: authResult.error });

      const metadata = await authResult.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size',
        supportsAllDrives: true,
      });

      const range = (request.headers.range as string) || undefined;
      const media = await authResult.drive.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
          headers: range ? { Range: range } : undefined,
        }
      );

      reply.header('Content-Type', metadata.data.mimeType || 'application/octet-stream');
      reply.header('Accept-Ranges', 'bytes');
      if (metadata.data.size) {
        reply.header('Content-Length', metadata.data.size);
      }

      return reply.send(media.data);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || 'Failed to stream media' });
    }
  });

  // GET /api/drive/project-stats - Aggregate stats for project media
  fastify.get('/drive/project-stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const projectId = (query?.projectId || '').trim();

      if (!projectId) return reply.status(400).send({ error: 'Project ID missing' });

      const files = await prisma.mediaFile.findMany({
        where: { projectId },
      });

      const folders = await prisma.mediaFolder.findMany({
        where: { projectId },
      });

      let totalSize = BigInt(0);
      let videoCount = 0;
      let imageCount = 0;

      files.forEach((f) => {
        if (f.size) totalSize += f.size;
        const mime = f.mimeType || '';
        if (mime.startsWith('video/')) videoCount += 1;
        else if (mime.startsWith('image/')) imageCount += 1;
      });

      return reply.send({
        folderCount: folders.length,
        fileCount: files.length,
        videoCount,
        imageCount,
        totalSize: totalSize.toString(),
      });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || 'Failed to load project media stats' });
    }
  });
};
