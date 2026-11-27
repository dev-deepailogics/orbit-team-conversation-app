import type { FastifyReply } from 'fastify';

/**
 * Headers for serving user-supplied files from our own origin.
 *
 * A file's MIME type comes from whoever uploaded it, so it can't be trusted: served inline as text/html (or any other
 * type a browser renders as a document) it would run script with the viewer's session. Only types that browsers
 * display passively are allowed inline; everything else is sent as an attachment, and every response except PDF gets a
 * sandboxing Content-Security-Policy so nothing in it can run even if a browser renders it anyway.
 */

const FALLBACK_TYPE = 'application/octet-stream';

// type/subtype made of RFC 7230 token characters, nothing else.
const MIME_SHAPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

// Allow-list of types browsers only ever display, never execute. Note: no SVG (it can carry script).
const INLINE_SAFE = /^(?:image\/(?:png|jpeg|gif|webp|avif|bmp)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf|text\/plain)$/;

// No script, no plugins, no forms, no framing; the file itself (image/video/audio) still renders.
const SANDBOX_CSP = "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'";

/** Lower-cased `type/subtype` without parameters, or `application/octet-stream` when missing or malformed. */
export function normalizeMimeType(raw: unknown): string {
  if (typeof raw !== 'string') return FALLBACK_TYPE;
  const base = raw.split(';', 1)[0].trim().toLowerCase();
  return MIME_SHAPE.test(base) ? base : FALLBACK_TYPE;
}

export function isInlineSafeType(mimeType: string): boolean {
  return INLINE_SAFE.test(mimeType);
}

/** RFC 6266 `Content-Disposition` value with an ASCII fallback and an RFC 5987 UTF-8 name. */
export function contentDisposition(kind: 'inline' | 'attachment', fileName: string): string {
  const name = fileName.trim() || 'file';
  // Printable ASCII only (also drops CR/LF), without the quote and backslash that would end the quoted string.
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  // encodeURIComponent leaves ' ( ) * unescaped, but RFC 5987 doesn't allow them.
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Sets Content-Type, Content-Disposition and the safety headers for a stored file. Leaves caching, ranges and length to
 * the caller.
 */
export function setStoredFileHeaders(
  reply: FastifyReply,
  file: { mimeType: unknown; fileName: string | null | undefined; forceDownload?: boolean }
): void {
  const type = normalizeMimeType(file.mimeType);
  const inline = !file.forceDownload && isInlineSafeType(type);
  // Keep a declared charset for text so it still displays correctly.
  const charset =
    type.startsWith('text/') && typeof file.mimeType === 'string'
      ? /;\s*charset="?([a-z0-9._:-]{1,40})"?/i.exec(file.mimeType)?.[1]
      : undefined;

  reply.header('Content-Type', charset ? `${type}; charset=${charset}` : type);
  reply.header('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', file.fileName ?? ''));
  reply.header('X-Content-Type-Options', 'nosniff');
  // Chrome refuses to show a PDF under a sandboxing CSP; its viewer runs PDF script outside our origin anyway.
  if (type !== 'application/pdf') {
    reply.header('Content-Security-Policy', SANDBOX_CSP);
  }
}

/** `?download=1` / `?download=true` asks for the file as an attachment. */
export function wantsDownload(query: unknown): boolean {
  const value = (query as { download?: unknown } | null | undefined)?.download;
  return value === '1' || value === 'true';
}
