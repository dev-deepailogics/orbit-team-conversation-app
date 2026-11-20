export function formatDuration(totalSeconds?: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Grabs the current frame of a video or canvas as a small JPEG data URL (thumbnail). Scaled down so
 * a 4K source doesn't produce a multi-megabyte thumbnail; the server rejects thumbnails over 512 KB.
 */
export function captureVideoFrame(source: HTMLVideoElement | HTMLCanvasElement, maxWidth = 640): string | null {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcW || !srcH) return null;
  const scale = Math.min(1, maxWidth / srcW);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * A ~30fps tick that keeps running while this tab is in the background. Main-thread timers are
 * throttled to ~1/s in hidden tabs (and requestAnimationFrame stops entirely), which is what made the
 * camera bubble stutter the moment you switched to the tab/window being recorded. Dedicated-worker
 * timers are not throttled that way. Falls back to setInterval where workers are unavailable.
 */
export function createBackgroundTicker(intervalMs: number, onTick: () => void): () => void {
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const source = `let id;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}`;
      const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = onTick;
      worker.postMessage(intervalMs);
      return () => {
        worker.postMessage(0);
        worker.terminate();
      };
    } catch {
      /* CSP or sandbox blocked blob workers: fall through to a main-thread timer */
    }
  }
  const id = setInterval(onTick, intervalMs);
  return () => clearInterval(id);
}

export function clipShareUrl(shareSlug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/clip/${shareSlug}`;
}

export const CLIP_LINK_PATTERN = /\/clip\/([a-zA-Z0-9-]{8,})/;
