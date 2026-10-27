// Only schemes the renderer will open; bare domains get https://. Returns null when unusable.
export function normalizeUrl(input: string): string | null {
  const url = input.trim();
  if (!url || /[\s()]/.test(url)) return null;
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme) return ['http', 'https', 'mailto'].includes(scheme) ? url : null;
  return url.includes('.') ? `https://${url}` : null;
}

// Message text is user-controlled: never hand other schemes (file:, intent:, ...) to Linking.
export function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}
