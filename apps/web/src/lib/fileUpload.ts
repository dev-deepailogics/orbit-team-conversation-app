import axios from 'axios';
import { UPLOAD_LIMITS, uploadRejectionReason } from '@orbit/types';
import { api } from './api';

/** What the server returns for an uploaded (staged) file; the attachment row is created when the message is sent. */
export interface UploadedFile {
  workspaceId: string;
  channelId?: string;
  uploaderId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storageProvider: string;
  uploader?: { id: string; username: string; displayName: string; avatarUrl?: string | null } | null;
}

export interface UploadOptions {
  workspaceId?: string;
  channelId?: string;
  /** 0-100, called as bytes are sent. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

export const isUploadCancelled = (err: unknown) =>
  err instanceof UploadCancelledError || axios.isCancel(err) || (err as any)?.name === 'CanceledError';

/** Why this file can't be uploaded (blocked type or over the size limit), or null when it can. */
export const validateUploadFile = (file: File) => uploadRejectionReason(file.name, file.size);

/** Splits files into ones that can be uploaded and readable messages for the ones that can't. */
export function partitionUploadable(files: File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const reason = validateUploadFile(file);
    if (reason) rejected.push(`${file.name}: ${reason}`);
    else accepted.push(file);
  }
  return { accepted, rejected };
}

/** Readable error text for a failed upload. */
export const uploadErrorMessage = (err: any, fallback = 'File upload failed') =>
  err?.response?.data?.error || err?.message || fallback;

const RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Network errors, timeouts, 5xx and 429 are worth retrying; other 4xx mean the request itself is wrong. */
const isRetryable = (err: any) => {
  const status = err?.response?.status;
  return !status || status >= 500 || status === 408 || status === 429;
};

async function withRetry<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new UploadCancelledError();
    try {
      return await run();
    } catch (err) {
      if (isUploadCancelled(err) || signal?.aborted) throw new UploadCancelledError();
      if (attempt >= RETRIES - 1 || !isRetryable(err)) throw err;
      await sleep(500 * 2 ** attempt); // 0.5s, 1s
    }
  }
}

/** One multipart request: used for files that fit in a single chunk (most images and documents). */
async function uploadSingle(file: File, opts: UploadOptions): Promise<UploadedFile> {
  const form = new FormData();
  if (opts.workspaceId) form.append('workspaceId', opts.workspaceId);
  if (opts.channelId) form.append('channelId', opts.channelId);
  form.append('file', file);
  const query = new URLSearchParams();
  if (opts.workspaceId) query.set('workspaceId', opts.workspaceId);
  if (opts.channelId) query.set('channelId', opts.channelId);
  const qs = query.toString();

  const res = await withRetry(
    () =>
      api.post<UploadedFile>(`/api/files/upload${qs ? `?${qs}` : ''}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: opts.signal,
        onUploadProgress: (e) => e.total && opts.onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100))),
      }),
    opts.signal,
  );
  opts.onProgress?.(100);
  return res.data;
}

/** Large files: sent as fixed-size chunks, a few at a time, each retried on its own; the server joins them. */
async function uploadChunked(file: File, opts: UploadOptions): Promise<UploadedFile> {
  const { signal } = opts;
  const init = await withRetry(
    () =>
      api.post<{ uploadId: string; chunkSize: number; totalChunks: number }>(
        '/api/files/uploads/init',
        {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
          workspaceId: opts.workspaceId,
          channelId: opts.channelId,
        },
        { signal },
      ),
    signal,
  );
  const { uploadId, chunkSize, totalChunks } = init.data;

  // Bytes confirmed per chunk, so progress never goes backwards when a chunk is retried.
  const sent = new Array<number>(totalChunks).fill(0);
  const report = () => {
    const loaded = sent.reduce((a, b) => a + b, 0);
    opts.onProgress?.(Math.min(99, Math.round((loaded / file.size) * 100)));
  };

  let next = 0;
  const worker = async () => {
    while (next < totalChunks) {
      const index = next++;
      const blob = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
      await withRetry(async () => {
        sent[index] = 0;
        await api.put(`/api/files/uploads/${uploadId}/chunks/${index}`, blob, {
          headers: { 'Content-Type': 'application/octet-stream' },
          signal,
          onUploadProgress: (e) => {
            sent[index] = Math.min(e.loaded, blob.size);
            report();
          },
        });
        sent[index] = blob.size;
        report();
      }, signal);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(UPLOAD_LIMITS.parallelChunks, totalChunks) }, worker));
    const done = await withRetry(
      // `{}` rather than no body: the api client always sends Content-Type: application/json, and the
      // server rejects an empty JSON body.
      () => api.post<UploadedFile>(`/api/files/uploads/${uploadId}/complete`, {}, { signal }),
      signal,
    );
    opts.onProgress?.(100);
    return done.data;
  } catch (err) {
    // Free the server-side chunks right away instead of waiting for the 24h sweep.
    api.delete(`/api/files/uploads/${uploadId}`).catch(() => {});
    throw err;
  }
}

/**
 * Uploads one file to Orbit's storage. Small files go in one request, large ones (up to 500 MB) in chunks.
 * Throws UploadCancelledError when `signal` is aborted; check the file with validateUploadFile() first.
 */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadedFile> {
  const reason = validateUploadFile(file);
  if (reason) throw new Error(reason);
  return file.size > UPLOAD_LIMITS.chunkBytes ? uploadChunked(file, opts) : uploadSingle(file, opts);
}
