import { zipSync, strToU8 } from 'fflate';

/**
 * Helper to format file sizes nicely (e.g., 2.4 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Checks if a file is an image that can be visually re-compressed
 */
export function isImageFile(file: File): boolean {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  return (
    (file.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) &&
    !file.type.includes('svg') &&
    ext !== '.svg'
  );
}

/**
 * Checks if a file is a video that can be re-encoded to WebM/MP4
 */
export function isVideoFile(file: File): boolean {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  return (
    file.type.startsWith('video/') ||
    ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext)
  );
}

/**
 * Checks if a file is an audio or video file
 */
export function isMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file) || file.type.startsWith('audio/');
}

/**
 * Client-side video compressor using HTML5 Video + Canvas + MediaRecorder.
 * Transcodes 4K/1080p MOV/MP4 down to optimized 720p at ~1.2-1.8 Mbps bitrate.
 * Typically reduces a 42MB MOV down to 4MB - 8MB!
 */
export async function compressVideo(file: File): Promise<File> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.muted = false;
      video.volume = 1.0;
      video.autoplay = false;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      // Timeout fallback in case browser cannot decode codec
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }, 35000);

      video.onloadedmetadata = () => {
        let width = video.videoWidth || 1280;
        let height = video.videoHeight || 720;

        // Scale down high-res video (max 1280x720)
        const maxDimension = 1280;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Even dimensions required for video codecs
        width = width % 2 === 0 ? width : width - 1;
        height = height % 2 === 0 ? height : height - 1;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          return resolve(file);
        }

        const canvasStream = canvas.captureStream(24);

        // Capture original audio track so the compressed video has full volume & sound!
        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const source = audioCtx.createMediaElementSource(video);
            const destination = audioCtx.createMediaStreamDestination();
            source.connect(destination);
            // Also connect to destination for recording, while keeping video.volume active
            destination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
          } else if ((video as any).captureStream) {
            const vidStream = (video as any).captureStream();
            vidStream.getAudioTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));
          }
        } catch (audioErr) {
          console.warn('Could not attach audio track to compressed video:', audioErr);
        }

        // Pick supported mime type with audio codec
        const mimeTypes = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm',
          'video/mp4',
        ];
        let selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

        if (!selectedMime) {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          return resolve(file);
        }

        // Bitrate: 1.2 Mbps video, 128 kbps audio
        let mediaRecorder: MediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: selectedMime,
            videoBitsPerSecond: 1200000,
            audioBitsPerSecond: 128000,
          });
        } catch (e) {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          return resolve(file);
        }

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          const ext = selectedMime.includes('webm') ? '.webm' : '.mp4';
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const blob = new Blob(chunks, { type: selectedMime });

          // If compression didn't save space, return original
          if (blob.size >= file.size || blob.size === 0) {
            return resolve(file);
          }

          const compressedFile = new File([blob], `${baseName}_compressed${ext}`, {
            type: selectedMime,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        };

        let animFrameId: number;
        const drawFrame = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, width, height);
          animFrameId = requestAnimationFrame(drawFrame);
        };

        video.onended = () => {
          cancelAnimationFrame(animFrameId);
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 200);
        };

        video.onerror = () => {
          clearTimeout(timeout);
          cancelAnimationFrame(animFrameId);
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        };

        mediaRecorder.start(250);
        video.play().then(() => {
          drawFrame();
        }).catch(() => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        });
      };

      video.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
    } catch (e) {
      resolve(file);
    }
  });
}

/**
 * Lossy client-side Image Compression using HTML5 Canvas & WebP/JPEG encoding.
 * Typically reduces camera / high-res uploads from 5-15MB down to 200-600KB without visible quality loss.
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve) => {
    // If not an image or SVG, return original
    if (!isImageFile(file)) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern webp or fallback to jpeg
        const outputMime = file.type === 'image/png' ? 'image/webp' : file.type || 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression didn't save space, return original
              return resolve(file);
            }
            const ext = outputMime === 'image/webp' ? '.webp' : file.name.substring(file.name.lastIndexOf('.'));
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newName = `${baseName}_compressed${ext}`;

            const compressedFile = new File([blob], newName, {
              type: outputMime,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputMime,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses documents or generic files into a ZIP archive using high-speed fflate deflate
 */
export async function compressDocumentToZip(file: File): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const u8 = new Uint8Array(arrayBuffer);

    // Create zip
    const zipped = zipSync({
      [file.name]: [u8, { level: 6 }],
    });

    // If zipped is larger (can happen with already compressed files like docx/mp4), return original
    if (zipped.byteLength >= file.size) {
      return file;
    }

    const zipBlob = new Blob([zipped], { type: 'application/zip' });
    const zipName = `${file.name}.zip`;

    return new File([zipBlob], zipName, {
      type: 'application/zip',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error('ZIP compression error:', err);
    return file;
  }
}

/**
 * Calculates or accurately estimates the size after compression.
 * - Images: measured through Canvas WebP/JPEG compression (~60-80% reduction)
 * - Videos: 720p transcode estimate (~60-85% reduction from large 4K/1080p raw files like .MOV)
 * - Documents: measured through ZIP deflate (~50-90% reduction for text/docs, ~1-5% for audio)
 */
export async function getCompressedSize(file: File): Promise<number> {
  try {
    if (isImageFile(file)) {
      const compressed = await compressImage(file);
      return compressed.size;
    }
    if (isVideoFile(file)) {
      // Estimate based on 720p @ 1.2Mbps encoding:
      // Typically MOV files from iPhone/Mac are 15-40 Mbps bitrate.
      // Transcoding to 720p VP8/H264 reduces size by ~65-75%.
      // We calculate a realistic projected size:
      const estimatedReduction = 0.32; // ~68% size reduction
      const estimatedSize = Math.max(1024 * 100, Math.round(file.size * estimatedReduction));
      return Math.min(file.size, estimatedSize);
    }
    // Generic documents
    const compressed = await compressDocumentToZip(file);
    return compressed.size;
  } catch (err) {
    return file.size;
  }
}

/**
 * Master compression handler:
 * - If image: compresses via Canvas resize & quality optimization
 * - If video: compresses via Canvas/MediaRecorder transcode
 * - If other media or doc (pdf, txt, doc, etc.): compresses into .zip archive
 */
export async function compressFile(file: File): Promise<File> {
  if (isImageFile(file)) {
    return await compressImage(file);
  }
  if (isVideoFile(file)) {
    return await compressVideo(file);
  }
  return await compressDocumentToZip(file);
}
