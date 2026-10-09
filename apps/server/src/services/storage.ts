import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

export interface StorageDriver {
  providerName: string;
  uploadFile(params: {
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    workspaceId: string;
    channelId?: string;
  }): Promise<{
    fileKey: string;
    fileUrl: string;
    fileSize: number;
    storageProvider: string;
  }>;
  deleteFile(fileKey: string): Promise<boolean>;
  getFileStream(fileKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    size?: number;
    mimeType?: string;
    fileName?: string;
  } | null>;
  getFilePath?(fileKey: string): string;
}

/**
 * Local Storage Driver
 * Stores files in the server uploads folder or Docker volume.
 * Files are structured by workspace and month: uploads/workspaces/:workspaceId/:year-:month/:fileKey
 */
export class LocalStorageDriver implements StorageDriver {
  public providerName = 'LOCAL';
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getFilePath(fileKey: string): string {
    return path.join(this.baseDir, fileKey);
  }

  public async uploadFile({
    stream,
    fileName,
    workspaceId,
  }: {
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
    workspaceId: string;
    channelId?: string;
  }): Promise<{
    fileKey: string;
    fileUrl: string;
    fileSize: number;
    storageProvider: string;
  }> {
    const date = new Date();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const targetDir = path.join(this.baseDir, 'workspaces', workspaceId, yearMonth);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = path.extname(fileName) || '';
    const rawBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeUniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${rawBase}${ext}`;

    const relativeKey = path.join('workspaces', workspaceId, yearMonth, safeUniqueName).replace(/\\/g, '/');
    const absolutePath = path.join(this.baseDir, relativeKey);

    const writeStream = fs.createWriteStream(absolutePath);
    await pipeline(stream, writeStream);

    const stat = await fs.promises.stat(absolutePath);

    // URL used for web requests
    const fileUrl = `/api/files/download/${relativeKey}`;

    return {
      fileKey: relativeKey,
      fileUrl,
      fileSize: stat.size,
      storageProvider: this.providerName,
    };
  }

  public async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const absolutePath = this.getFilePath(fileKey);
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to delete local file: ${fileKey}`, err);
      return false;
    }
  }

  public async getFileStream(fileKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    size?: number;
    fileName?: string;
  } | null> {
    const absolutePath = this.getFilePath(fileKey);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const stat = await fs.promises.stat(absolutePath);
    const stream = fs.createReadStream(absolutePath);
    return {
      stream,
      size: stat.size,
      fileName: path.basename(absolutePath),
    };
  }
}

// Default storage driver instance (Local by default, easily swapped with Firebase/S3)
export const storageDriver: StorageDriver = new LocalStorageDriver();

/**
 * Classify file types into readable storage categories
 */
export function classifyFileType(
  mimeType: string,
  fileName: string
): 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'code' | 'other' {
  const mime = (mimeType || '').toLowerCase();
  const ext = (path.extname(fileName) || '').toLowerCase();

  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audio';

  if (
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('presentation') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.csv'].includes(ext)
  ) {
    return 'documents';
  }

  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('rar') ||
    mime.includes('7z') ||
    mime.includes('compressed') ||
    ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.bz2'].includes(ext)
  ) {
    return 'archives';
  }

  if (
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('html') ||
    mime.includes('xml') ||
    [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs',
      '.php', '.rb', '.sh', '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.sql'
    ].includes(ext)
  ) {
    return 'code';
  }

  return 'other';
}

/**
 * Format bytes into human-readable strings (KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
