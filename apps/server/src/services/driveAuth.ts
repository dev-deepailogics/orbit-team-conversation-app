import { google } from 'googleapis';
import { prisma } from '@orbit/db';

export const GOOGLE_DRIVE_RECONNECT_MESSAGE = 'Google Drive authorization expired. Please reconnect Google Drive.';

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/google/callback'
  );
}

export function getGoogleApiErrorMessage(error: any): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  return (
    error.response?.data?.error_description ||
    error.response?.data?.error ||
    error.errors?.[0]?.message ||
    error.message ||
    ''
  );
}

export function isGoogleAuthError(error: any): boolean {
  const status = error?.response?.status || error?.status || error?.code;
  const message = [
    error?.response?.data?.error,
    error?.response?.data?.error_description,
    error?.errors?.[0]?.reason,
    error?.errors?.[0]?.message,
    error?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    status === 401 ||
    message.includes('invalid_grant') ||
    message.includes('invalid credentials') ||
    message.includes('login required')
  );
}

export function getGoogleAuthErrorPayload(error: any) {
  if (!isGoogleAuthError(error)) return null;

  return {
    error: GOOGLE_DRIVE_RECONNECT_MESSAGE,
    code: 'GOOGLE_DRIVE_AUTH_EXPIRED',
    requiresReconnect: true,
  };
}

export function getConfiguredRootFolderIds(): string[] {
  const folderIds = process.env.GOOGLE_DRIVE_ROOT_FOLDER_IDS || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '';

  return folderIds
    .split(',')
    .map((folderId) => folderId.trim())
    .filter(Boolean);
}

export async function getAuthenticatedDrive(): Promise<
  | { drive: any; auth: any; updatedAt: string | null }
  | { error: string; status: number; code?: string; requiresReconnect?: boolean }
> {
  const tokenRecord = await prisma.googleOAuth.findUnique({
    where: { id: 'google_oauth' },
  });

  let tokens = tokenRecord ? (tokenRecord.tokens as any) : null;

  // Support env-level refresh token fallback for permanent headless setup
  if (!tokens && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    tokens = {
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    };
  }

  if (!tokens) {
    return {
      error: 'Google Drive not connected. Please connect Google Drive first.',
      status: 401,
    };
  }

  if (!tokens.refresh_token) {
    return {
      error: GOOGLE_DRIVE_RECONNECT_MESSAGE,
      code: 'GOOGLE_DRIVE_AUTH_EXPIRED',
      requiresReconnect: true,
      status: 401,
    };
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    ...tokens,
    expiry_date: tokens.expiry_date || 1,
  });

  try {
    await oauth2Client.getAccessToken();
  } catch (refreshErr) {
    if (isGoogleAuthError(refreshErr)) {
      return {
        error: GOOGLE_DRIVE_RECONNECT_MESSAGE,
        code: 'GOOGLE_DRIVE_AUTH_EXPIRED',
        requiresReconnect: true,
        status: 401,
      };
    }
  }

  const currentTokens = { ...tokens, ...oauth2Client.credentials };

  if (
    currentTokens.access_token !== tokens.access_token ||
    currentTokens.expiry_date !== tokens.expiry_date
  ) {
    try {
      await prisma.googleOAuth.upsert({
        where: { id: 'google_oauth' },
        update: {
          tokens: currentTokens,
        },
        create: {
          id: 'google_oauth',
          tokens: currentTokens,
        },
      });
    } catch (saveErr) {
      console.error('Failed to update refreshed Google OAuth tokens:', saveErr);
    }
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  return {
    drive,
    auth: oauth2Client,
    updatedAt: tokenRecord?.updatedAt ? tokenRecord.updatedAt.toISOString() : new Date().toISOString(),
  };
}
