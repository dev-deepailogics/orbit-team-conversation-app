'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Square,
  Circle,
  Mic,
  MicOff,
  Monitor,
  Send,
  Loader2,
  Video as CameraIcon,
  VideoOff,
  Pause,
  Play,
  UploadCloud,
  ChevronDown,
  Hash,
  Lock,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Channel, Recording, WorkspaceMember } from '@orbit/types';
import { captureVideoFrame, clipShareUrl, formatDuration } from './recordingUtils';

interface RecorderOverlayProps {
  workspaceId: string;
  /** Conversations the clip can be shared into ("Share in Orbit"). */
  channels?: Channel[];
  members?: WorkspaceMember[];
  currentUserId?: string;
  onClose: () => void;
  /** Called once the clip is saved (to the library, or shared into a conversation). */
  onUploaded: (recording: Recording) => void;
}

type RecorderPhase = 'setup' | 'recording' | 'paused' | 'preview' | 'uploading';
type SaveAction = 'library' | 'share';
/** Where "Share in Orbit" posts the clip: an existing channel, or a DM opened with a member. */
type ShareTarget = { kind: 'channel'; channel: Channel } | { kind: 'dm'; userId: string; name: string };
type CaptureMode = 'screen' | 'camera' | 'screen+camera';

const PREFERRED_MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const BUBBLE_SIZE = 140;
const FALLBACK_WIDTH = 1280;
const FALLBACK_HEIGHT = 720;
const DRAW_INTERVAL_MS = Math.round(1000 / 30);

function pickSupportedMimeType(): string {
  for (const type of PREFERRED_MIME_TYPES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

/** Resolves once the video element has real decoded dimensions, or after a short timeout. */
function waitForVideoDimensions(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
    video.addEventListener('loadedmetadata', onLoaded);
  });
}

export const RecorderOverlay: React.FC<RecorderOverlayProps> = ({
  workspaceId,
  channels = [],
  members = [],
  currentUserId,
  onClose,
  onUploaded,
}) => {
  const [saveAction, setSaveAction] = useState<SaveAction | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [phase, setPhase] = useState<RecorderPhase>('setup');
  const [mode, setMode] = useState<CaptureMode>('screen+camera');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [title, setTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bubblePos, setBubblePos] = useState({ x: 24, y: 24 });

  const bubblePosRef = useRef(bubblePos);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);

  const screenVideoElRef = useRef<HTMLVideoElement | null>(null);
  const camVideoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Drives the compositor. Deliberately setInterval, not requestAnimationFrame — rAF is
  // paused outright by the browser whenever this tab isn't the visible/focused one, which
  // is exactly what happens the instant you switch to the window/tab you're sharing.
  // setInterval keeps running (Chrome only throttles it after several minutes hidden).
  const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setupPreviewRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });

  const stopAllTracks = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    camStreamRef.current = null;
    micStreamRef.current = null;
    if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
    drawIntervalRef.current = null;
    screenVideoElRef.current?.remove();
    camVideoElRef.current?.remove();
    screenVideoElRef.current = null;
    camVideoElRef.current = null;
  };

  // Setup-phase self-check camera preview. Safe to show as a real live feed because
  // nothing is being screen-captured yet — swapped out for a position-only drag handle
  // the instant recording starts, so the camera is never baked into the output twice.
  useEffect(() => {
    // Only manage the camera while setting up. Leaving setup means recording has taken over this
    // very stream for the bubble; stopping it here is what made the recorded bubble solid black.
    // stopAllTracks() releases it when recording stops or the overlay closes.
    if (phase !== 'setup') return;

    if (mode === 'screen' || !cameraEnabled) {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      return;
    }

    // Already have a live camera (e.g. switching between "Screen + Cam" and "Camera"): reuse it.
    const live = camStreamRef.current;
    if (live && live.getVideoTracks().some((t) => t.readyState === 'live')) {
      if (setupPreviewRef.current && setupPreviewRef.current.srcObject !== live) {
        setupPreviewRef.current.srcObject = live;
        setupPreviewRef.current.play().catch(() => {});
      }
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        camStreamRef.current = stream;
        if (setupPreviewRef.current) {
          setupPreviewRef.current.srcObject = stream;
          setupPreviewRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setCameraEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, [phase, mode, cameraEnabled]);

  useEffect(() => {
    return () => {
      stopAllTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draws one composited frame (screen + circular camera bubble overlay) onto the capture
  // canvas. The canvas's pixel dimensions are locked once (see startRecording) and never
  // changed again here — resizing a canvas while MediaRecorder is actively recording its
  // captureStream() produces broken/unplayable output in most browsers.
  const drawFrame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const screenVideo = screenVideoElRef.current;
    const camVideo = camVideoElRef.current;

    if (mode === 'camera' && camVideo && camVideo.videoWidth) {
      ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
    } else if (screenVideo && screenVideo.videoWidth) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

      if (mode === 'screen+camera' && camVideo && camVideo.videoWidth) {
        const radius = Math.round(canvas.width * 0.09);
        // Map the draggable handle's on-screen position (in viewport pixels) onto the
        // captured frame, so the baked-in bubble follows where it was dragged.
        const fracX = (bubblePosRef.current.x + BUBBLE_SIZE / 2) / window.innerWidth;
        const fracY = (bubblePosRef.current.y + BUBBLE_SIZE / 2) / window.innerHeight;
        const cx = Math.min(canvas.width - radius, Math.max(radius, fracX * canvas.width));
        const cy = Math.min(canvas.height - radius, Math.max(radius, fracY * canvas.height));

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const camAspect = camVideo.videoWidth / camVideo.videoHeight;
        const size = radius * 2;
        let sx = 0, sy = 0, sw = camVideo.videoWidth, sh = camVideo.videoHeight;
        if (camAspect > 1) {
          sw = camVideo.videoHeight;
          sx = (camVideo.videoWidth - sw) / 2;
        } else {
          sh = camVideo.videoWidth;
          sy = (camVideo.videoHeight - sh) / 2;
        }
        ctx.drawImage(camVideo, sx, sy, sw, sh, cx - radius, cy - radius, size, size);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, radius * 0.04);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.stroke();
      }
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      // The setup-phase self-check preview may already hold the camera stream — reuse it
      // instead of asking for permission / re-acquiring the device a second time.
      let screenStream: MediaStream | null = null;
      // Reuse the setup preview's camera only if it's still live; an ended track draws black frames.
      let camStream: MediaStream | null =
        camStreamRef.current?.getVideoTracks().some((t) => t.readyState === 'live') ? camStreamRef.current : null;

      if (mode !== 'camera') {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
        screenStreamRef.current = screenStream;
      }

      if (mode !== 'screen' && cameraEnabled && !camStream) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
          camStreamRef.current = camStream;
        } catch (camErr) {
          console.warn('Camera unavailable', camErr);
          setCameraEnabled(false);
        }
      }

      if (!screenStream && !camStream) {
        setError('No screen or camera source available to record.');
        return;
      }

      // Off-screen (but DOM-attached) <video> sources feeding the canvas compositor —
      // kept in the document rather than fully detached, since some browsers are
      // inconsistent about decoding a continuous MediaStream on a detached element.
      // We wait for real decoded dimensions (not just play() resolving) before locking
      // the canvas size below.
      const mountOffscreen = (v: HTMLVideoElement) => {
        v.style.position = 'fixed';
        v.style.top = '0';
        v.style.left = '-99999px';
        v.style.opacity = '0';
        v.style.pointerEvents = 'none';
        document.body.appendChild(v);
      };

      if (screenStream) {
        const v = document.createElement('video');
        v.srcObject = screenStream;
        v.muted = true;
        mountOffscreen(v);
        await v.play().catch(() => {});
        await waitForVideoDimensions(v);
        screenVideoElRef.current = v;
      }
      if (camStream) {
        const v = document.createElement('video');
        v.srcObject = camStream;
        v.muted = true;
        mountOffscreen(v);
        await v.play().catch(() => {});
        await waitForVideoDimensions(v);
        camVideoElRef.current = v;
      }

      // Lock the canvas's pixel size ONCE, before any frame is drawn or captureStream() is
      // called, using the real source dimensions — never resized again afterwards.
      const canvas = canvasRef.current!;
      const primary = mode === 'camera' ? camVideoElRef.current : screenVideoElRef.current;
      canvas.width = primary?.videoWidth || FALLBACK_WIDTH;
      canvas.height = primary?.videoHeight || FALLBACK_HEIGHT;

      drawIntervalRef.current = setInterval(drawFrame, DRAW_INTERVAL_MS);

      // Audio: mix screen audio + mic into one track
      let audioTracks: MediaStreamTrack[] = [];
      const audioSources = [screenStream, micEnabled ? await getMicStream() : null].filter(
        (s): s is MediaStream => !!s && s.getAudioTracks().length > 0
      );
      if (audioSources.length > 0) {
        const audioCtx = new AudioContext();
        const destination = audioCtx.createMediaStreamDestination();
        audioSources.forEach((s) => audioCtx.createMediaStreamSource(s).connect(destination));
        audioTracks = destination.stream.getAudioTracks();
      }

      // Let a couple of real frames land on the now-fixed-size canvas before recording starts
      await new Promise((r) => setTimeout(r, 100));
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
      };

      screenStream?.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      });

      recorder.start();
      recorderRef.current = recorder;
      setPhase('recording');
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch (err: any) {
      setError(err?.message || 'Could not start recording. Check permissions and try again.');
    }
  };

  const getMicStream = async (): Promise<MediaStream | null> => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;
      return micStream;
    } catch {
      return null;
    }
  };

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
      setPhase('recording');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    stopAllTracks();
  };

  const discardAndClose = () => {
    stopAllTracks();
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  /** Uploads the clip. No channel = workspace library (visible to everyone in the workspace). */
  const uploadClip = async (targetChannelId?: string): Promise<Recording> => {
    const blob = blobRef.current!;
    let thumbnailDataUrl: string | null = null;
    try {
      if (previewVideoRef.current) thumbnailDataUrl = captureVideoFrame(previewVideoRef.current);
    } catch (thumbErr) {
      console.warn('Thumbnail capture failed, uploading without one', thumbErr);
    }

    // @fastify/multipart only parses text fields as the stream advances, so any field
    // placed AFTER the file part isn't available when the route reads request.file()
    // — they must be appended before 'file', same convention as the file-upload route.
    const formData = new FormData();
    formData.append('workspaceId', workspaceId);
    if (targetChannelId) formData.append('channelId', targetChannelId);
    formData.append('title', title.trim() || 'Untitled recording');
    formData.append('durationSec', String(elapsedSec));
    if (thumbnailDataUrl) formData.append('thumbnailDataUrl', thumbnailDataUrl);
    formData.append('file', blob, 'recording.webm');

    const res = await api.post<Recording>('/api/recordings/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  };

  const runSave = async (action: SaveAction, work: () => Promise<Recording>) => {
    if (!blobRef.current) return;
    setShareOpen(false);
    setSaveAction(action);
    setPhase('uploading');
    setError(null);
    try {
      onUploaded(await work());
    } catch (err: any) {
      setError(err.response?.data?.error || (action === 'share' ? 'Failed to share recording' : 'Failed to upload recording'));
      setPhase('preview');
    } finally {
      setSaveAction(null);
    }
  };

  const uploadToLibrary = () => runSave('library', () => uploadClip());

  // Save the clip to the chosen conversation and post it there as a message (rendered as a player).
  const shareInOrbit = (target: ShareTarget) =>
    runSave('share', async () => {
      const targetChannelId =
        target.kind === 'channel'
          ? target.channel.id
          : (await api.post<Channel>(`/api/channels/workspaces/${workspaceId}/dm`, { targetUserId: target.userId })).data.id;

      const recording = await uploadClip(targetChannelId);
      const message = await api.post(`/api/channels/${targetChannelId}/messages`, {
        content: clipShareUrl(recording.shareSlug),
      });
      // Link the clip to its message; the clip is already posted, so a failure here isn't fatal.
      if (message.data?.id) {
        await api.post(`/api/recordings/${recording.id}/attach`, { messageId: message.data.id }).catch(() => {});
      }
      return recording;
    });

  // Draggable position handle for the baked-in camera bubble. Deliberately NOT a live
  // video feed: if you share this very tab, anything rendered on it gets captured too,
  // so a real camera preview here would bake a second copy of your face into the
  // recording on top of the one the canvas compositor already draws off-screen.
  const onBubblePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, offsetX: e.clientX - bubblePos.x, offsetY: e.clientY - bubblePos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onBubblePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const next = { x: e.clientX - dragRef.current.offsetX, y: e.clientY - dragRef.current.offsetY };
    bubblePosRef.current = next;
    setBubblePos(next);
  };
  const onBubblePointerUp = () => {
    dragRef.current.dragging = false;
  };

  const isLive = phase === 'recording' || phase === 'paused';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* display:none can stop Chrome from actually repainting a canvas, which makes
          captureStream() emit a frozen/blank frame instead of live video — so this is
          pushed off-screen with position/opacity instead of being display:none. */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 0, left: '-99999px', opacity: 0, pointerEvents: 'none' }}
      />

      {/* Setup / preview / upload card — hidden once live so it doesn't block the screen being recorded */}
      {!isLive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          {/* No overflow-hidden: the "Share in Orbit" menu must be able to extend past the card. */}
          <div className="w-full max-w-lg bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-slack-green" />
                <span className="text-sm font-semibold text-[var(--theme-text)]">Record a clip</span>
              </div>
              <button
                onClick={discardAndClose}
                className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
              )}

              {phase === 'setup' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  {mode !== 'screen' && cameraEnabled && (
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[var(--theme-border)] bg-black">
                      <video ref={setupPreviewRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl p-1">
                    {([
                      { key: 'screen', label: 'Screen', icon: Monitor },
                      { key: 'screen+camera', label: 'Screen + Cam', icon: CameraIcon },
                      { key: 'camera', label: 'Camera', icon: CameraIcon },
                    ] as { key: CaptureMode; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition ${
                          mode === key ? 'bg-slack-green text-white font-semibold' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                        }`}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCameraEnabled((v) => !v)}
                      disabled={mode === 'screen'}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${
                        cameraEnabled
                          ? 'border-slack-green text-slack-green bg-slack-green/10'
                          : 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                      }`}
                    >
                      {cameraEnabled ? <CameraIcon size={14} /> : <VideoOff size={14} />}
                      {cameraEnabled ? 'Camera on' : 'Camera off'}
                    </button>
                    <button
                      onClick={() => setMicEnabled((v) => !v)}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
                        micEnabled
                          ? 'border-slack-green text-slack-green bg-slack-green/10'
                          : 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                      }`}
                    >
                      {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                      {micEnabled ? 'Microphone on' : 'Microphone off'}
                    </button>
                  </div>

                  <p className="text-xs text-[var(--theme-text-muted)] text-center max-w-xs">
                    {mode === 'camera'
                      ? "You'll record from your webcam only."
                      : "Your browser will ask you to pick a screen, window, or tab to share. Recording starts immediately after."}
                  </p>

                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slack-green hover:bg-slack-green/90 text-white rounded-xl font-semibold text-sm transition"
                  >
                    <Circle size={14} className="fill-white" />
                    Start recording
                  </button>
                </div>
              )}

              {(phase === 'preview' || phase === 'uploading') && previewUrl && (
                <div className="flex flex-col gap-3">
                  <video ref={previewVideoRef} src={previewUrl} controls className="w-full rounded-lg bg-black max-h-60" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give this clip a title..."
                    maxLength={200}
                    disabled={phase === 'uploading'}
                    className="text-sm bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-[var(--theme-text)] focus:outline-none focus:border-slack-green"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--theme-text-muted)] font-mono">{formatDuration(elapsedSec)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={uploadToLibrary}
                        disabled={phase === 'uploading'}
                        title="Save to this workspace's Video Library"
                        className="flex items-center gap-2 px-3.5 py-1.5 border border-[var(--theme-border)] text-[var(--theme-text)] bg-[var(--theme-bg-app)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg text-xs font-semibold transition disabled:opacity-60"
                      >
                        {saveAction === 'library' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                        {saveAction === 'library' ? 'Uploading...' : 'Upload to library'}
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShareOpen((v) => !v)}
                          disabled={phase === 'uploading'}
                          aria-haspopup="listbox"
                          aria-expanded={shareOpen}
                          className="flex items-center gap-2 px-3.5 py-1.5 bg-slack-green hover:bg-slack-green/90 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60"
                        >
                          {saveAction === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          {saveAction === 'share' ? 'Sharing...' : 'Share in Orbit'}
                          {saveAction !== 'share' && <ChevronDown size={13} />}
                        </button>
                        {shareOpen && (
                          <ShareTargetMenu
                            channels={channels}
                            members={members}
                            currentUserId={currentUserId}
                            onPick={shareInOrbit}
                            onClose={() => setShareOpen(false)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Draggable position handle for the baked-in camera bubble — no live video, see note above */}
      {isLive && mode !== 'screen' && cameraEnabled && (
        <div
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
          style={{ left: bubblePos.x, top: bubblePos.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
          className="fixed rounded-full flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/70 shadow-2xl cursor-move pointer-events-auto bg-black/40 backdrop-blur-sm text-white/80"
        >
          <CameraIcon size={20} />
          <span className="text-[9px] font-semibold">Drag me</span>
        </div>
      )}

      {/* Our own compact floating control bar — not the browser's share-picker chrome */}
      {isLive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] shadow-2xl rounded-full px-4 py-2 pointer-events-auto">
          <span className="flex items-center gap-1.5 text-xs font-mono text-red-500">
            <span className={`w-2 h-2 rounded-full bg-red-500 ${phase === 'recording' ? 'animate-pulse' : ''}`} />
            {phase === 'paused' ? 'PAUSED' : 'REC'} {formatDuration(elapsedSec)}
          </span>
          <span className="w-px h-5 bg-[var(--theme-border)]" />
          <button
            onClick={togglePause}
            title={phase === 'paused' ? 'Resume' : 'Pause'}
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-full transition"
          >
            {phase === 'paused' ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            onClick={stopRecording}
            title="Stop recording"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold transition"
          >
            <Square size={11} className="fill-white" />
            Stop
          </button>
          <button
            onClick={discardAndClose}
            title="Cancel recording"
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-full transition"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * "Share in Orbit" picker: the user's channels plus a DM with any workspace member. Anonymous
 * channels are left out — a recording carries its creator, which would unmask the poster.
 */
const ShareTargetMenu: React.FC<{
  channels: Channel[];
  members: WorkspaceMember[];
  currentUserId?: string;
  onPick: (target: ShareTarget) => void;
  onClose: () => void;
}> = ({ channels, members, currentUserId, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // The toggle button is the menu's previous sibling; let its own click handle toggling.
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const channelTargets = useMemo(
    () =>
      channels
        .filter((c) => c.type !== 'DIRECT' && !c.isAnonymous && !c.isArchived)
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [channels, q],
  );
  const dmTargets = useMemo(
    () =>
      members
        .filter((m) => m.user && m.user.id !== currentUserId)
        .map((m) => ({ id: m.user!.id, name: m.user!.displayName || m.user!.username }))
        .filter((u) => !q || u.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, currentUserId, q],
  );

  const row = 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition';
  const heading = 'px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]';

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Share in Orbit"
      className="absolute right-0 bottom-full mb-2 w-64 max-h-80 flex flex-col bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl shadow-2xl z-10"
    >
      <div className="p-2 border-b border-[var(--theme-border)]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a channel or person"
            className="w-full text-xs bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg pl-7 pr-2 py-1.5 text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-slack-green"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {channelTargets.length > 0 && <div className={heading}>Channels</div>}
        {channelTargets.map((c) => (
          <button key={c.id} type="button" role="option" aria-selected={false} className={row} onClick={() => onPick({ kind: 'channel', channel: c })}>
            {c.type === 'PRIVATE' ? <Lock size={13} className="shrink-0 opacity-70" /> : <Hash size={13} className="shrink-0 opacity-70" />}
            <span className="truncate">{c.name}</span>
          </button>
        ))}
        {dmTargets.length > 0 && <div className={heading}>Direct messages</div>}
        {dmTargets.map((u) => (
          <button key={u.id} type="button" role="option" aria-selected={false} className={row} onClick={() => onPick({ kind: 'dm', userId: u.id, name: u.name })}>
            <span className="w-4 h-4 rounded-full bg-[var(--theme-bg-surface-hover)] flex items-center justify-center text-[9px] font-bold shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate">{u.name}</span>
          </button>
        ))}
        {channelTargets.length === 0 && dmTargets.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-[var(--theme-text-muted)]">No matches</p>
        )}
      </div>
    </div>
  );
};
