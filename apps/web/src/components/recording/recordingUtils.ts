export function formatDuration(totalSeconds?: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Grabs the current frame of a <video> element as a JPEG data URL, for a thumbnail. */
export function captureVideoFrame(video: HTMLVideoElement): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export function clipShareUrl(shareSlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/clip/${shareSlug}`;
}

export const CLIP_LINK_PATTERN = /\/clip\/([a-zA-Z0-9-]{8,})/;
