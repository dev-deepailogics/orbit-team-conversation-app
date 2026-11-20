'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronDown,
  Hash,
  Lock,
  Search,
  Check,
  Download,
  RotateCcw,
  Trash2,
  PictureInPicture2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Channel, Recording, RECORDING_LIMITS, WorkspaceMember } from '@orbit/types';
import { captureVideoFrame, clipShareUrl, createBackgroundTicker, formatDuration } from './recordingUtils';

interface RecorderOverlayProps {
  workspaceId: string;
  /** Conversation the recorder was opened from; offered first under "Share in Orbit". */
  suggestedChannelId?: string;
  /** Conversations the clip can be shared into ("Share in Orbit"). */
  channels?: Channel[];
  members?: WorkspaceMember[];
  currentUserId?: string;
  onClose: () => void;
}

type RecorderPhase = 'setup' | 'starting' | 'recording' | 'paused' | 'review';
type CaptureMode = 'screen' | 'camera' | 'screen+camera';
/** After Stop the clip saves itself to the Video Library; "unsavable" = too large or empty (download only). */
type SaveState = 'uploading' | 'saved' | 'failed' | 'unsavable';
/** Where "Share in Orbit" posts the clip: an existing channel, or a DM opened with a member. */
type ShareTarget = { kind: 'channel'; channel: Channel } | { kind: 'dm'; userId: string; name: string };

// ---- Encoding ---------------------------------------------------------------------------------
// MP4/H.264 first: most machines encode it in hardware (smooth, low CPU) and it plays everywhere
// (Safari can only record MP4). VP8 next; VP9 last because software VP9 is the most CPU-hungry and
// was a major source of lag. Bitrate is capped so a 5-minute clip is ~100 MB, under the server limit.
const PREFERRED_MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];
const VIDEO_BITS_PER_SECOND = 2_500_000;
const AUDIO_BITS_PER_SECOND = 128_000;
const TIMESLICE_MS = 1000; // flush encoded data every second instead of holding one giant buffer

// ---- Capture ----------------------------------------------------------------------------------
// Capture at most 1080p/30fps. Full-resolution 1440p/4K frames were the other big lag source:
// every frame had to be redrawn and encoded at that size.
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const FPS = 30;
const FRAME_MS = Math.round(1000 / FPS);
const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: { frameRate: { ideal: FPS, max: FPS }, width: { max: MAX_WIDTH }, height: { max: MAX_HEIGHT } },
  audio: true,
};
const CAMERA_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: FPS } };
const BUBBLE_SIZE = 176;
const BUBBLE_BORDER = 3;
const MAX_DURATION_MS = RECORDING_LIMITS.maxDurationSec * 1000;
const WARN_REMAINING_SEC = 30;
const THUMBNAIL_AT_MS = 1000;

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

const hasLiveVideo = (s: MediaStream | null) => !!s?.getVideoTracks().some((t) => t.readyState === 'live');

/** Resolves once the video element has real decoded dimensions, or after a short timeout. */
function waitForVideoDimensions(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    video.addEventListener('loadedmetadata', done);
  });
}

/** Off-screen but DOM-attached <video> (some browsers stop decoding detached MediaStream elements). */
async function mountSourceVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.srcObject = stream;
  v.muted = true;
  v.playsInline = true;
  Object.assign(v.style, { position: 'fixed', top: '0', left: '-99999px', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(v);
  await v.play().catch(() => {});
  await waitForVideoDimensions(v);
  return v;
}

/**
 * Where the Orbit page sits inside the captured image, in CSS pixels: the page's offset and the size of the
 * whole captured area. Used to draw the camera exactly on top of the live bubble, so whenever Orbit itself is
 * visible in the recording there's one bubble, not two. (A window or screen that doesn't show Orbit just
 * gets the camera at the same relative spot.)
 */
function captureArea(surface: string | undefined) {
  const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const chromeY = Math.max(0, window.outerHeight - window.innerHeight); // tabs + address bar
  if (surface === 'monitor') {
    const scr = window.screen as Screen & { availLeft?: number; availTop?: number };
    return {
      left: window.screenX - (scr.availLeft ?? 0) + chromeX,
      top: window.screenY - (scr.availTop ?? 0) + chromeY,
      width: scr.width,
      height: scr.height,
    };
  }
  if (surface === 'window') return { left: chromeX, top: chromeY, width: window.outerWidth, height: window.outerHeight };
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }; // a tab: exactly the page
}

/** Everything one recording session holds; released in exactly one place (releaseSession). */
interface Session {
  screen: MediaStream | null;
  cam: MediaStream | null;
  mic: MediaStream | null;
  audioCtx: AudioContext | null;
  screenEl: HTMLVideoElement | null;
  camEl: HTMLVideoElement | null;
  recorder: MediaRecorder | null;
  stopTicker: (() => void) | null;
  mimeType: string;
  /** Screen + camera: the camera is always drawn into the frames by us (never left to the screen capture). */
  composite: boolean;
  /** What the user shared: 'browser' (a tab), 'window' or 'monitor' (whole screen). Decides bubble mapping. */
  surface: string | undefined;
  /** Recorded time = accumulatedMs + (now - segmentStart) while running; paused time never counts. */
  accumulatedMs: number;
  segmentStart: number | null;
  thumbnail: string | null;
  discarded: boolean;
}

const emptySession = (): Session => ({
  screen: null,
  cam: null,
  mic: null,
  audioCtx: null,
  screenEl: null,
  camEl: null,
  recorder: null,
  stopTicker: null,
  mimeType: 'video/webm',
  composite: false,
  surface: undefined,
  accumulatedMs: 0,
  segmentStart: null,
  thumbnail: null,
  discarded: false,
});

export const RecorderOverlay: React.FC<RecorderOverlayProps> = ({
  workspaceId,
  suggestedChannelId,
  channels = [],
  members = [],
  currentUserId,
  onClose,
}) => {
  const [phase, setPhase] = useState<RecorderPhase>('setup');
  const [mode, setMode] = useState<CaptureMode>('screen+camera');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [title, setTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bubblePos, setBubblePos] = useState({ x: 24, y: 24 });
  const [shareOpen, setShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('uploading');
  const [saved, setSaved] = useState<Recording | null>(null);
  const [busy, setBusy] = useState<'share' | 'delete' | null>(null);
  // Live self-view while recording, and whether it has been popped out into a floating window.
  const [liveCam, setLiveCam] = useState<MediaStream | null>(null);
  const [pipActive, setPipActive] = useState(false);

  const sessionRef = useRef<Session>(emptySession());
  const setupCamRef = useRef<MediaStream | null>(null); // self-check preview stream, handed to the session on start
  const blobRef = useRef<Blob | null>(null);
  const durationSecRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const savedRef = useRef<Recording | null>(null);
  const titleRef = useRef('');
  const defaultTitleRef = useRef('Untitled recording');
  const bubblePosRef = useRef(bubblePos);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const setupPreviewRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const bubbleVideoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  titleRef.current = title;

  const elapsedMs = () => {
    const s = sessionRef.current;
    return s.accumulatedMs + (s.segmentStart !== null ? performance.now() - s.segmentStart : 0);
  };

  /** Stops every track, timer, worker and audio graph the session owns. Safe to call repeatedly. */
  const releaseSession = useCallback(() => {
    const s = sessionRef.current;
    const bubble = bubbleVideoRef.current;
    if (bubble && typeof document !== 'undefined' && document.pictureInPictureElement === bubble) {
      document.exitPictureInPicture().catch(() => {});
    }
    setLiveCam(null);
    s.stopTicker?.();
    [s.screen, s.cam, s.mic].forEach((stream) => stream?.getTracks().forEach((t) => t.stop()));
    s.audioCtx?.close().catch(() => {});
    s.screenEl?.remove();
    s.camEl?.remove();
    Object.assign(s, { screen: null, cam: null, mic: null, audioCtx: null, screenEl: null, camEl: null, stopTicker: null });
  }, []);

  const releaseSetupCamera = () => {
    setupCamRef.current?.getTracks().forEach((t) => t.stop());
    setupCamRef.current = null;
  };

  // Self-check camera preview, only while setting up. Recording takes over this stream; leaving setup
  // must NOT stop it (stopping it here is what used to bake a solid-black camera bubble into videos).
  useEffect(() => {
    if (phase !== 'setup') return;
    if (mode === 'screen' || !cameraEnabled) {
      releaseSetupCamera();
      return;
    }
    const attach = (stream: MediaStream) => {
      if (setupPreviewRef.current && setupPreviewRef.current.srcObject !== stream) {
        setupPreviewRef.current.srcObject = stream;
        setupPreviewRef.current.play().catch(() => {});
      }
    };
    if (hasLiveVideo(setupCamRef.current)) {
      attach(setupCamRef.current!);
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: CAMERA_CONSTRAINTS })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        setupCamRef.current = stream;
        attach(stream);
      })
      .catch(() => !cancelled && setCameraEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [phase, mode, cameraEnabled]);

  // Unmount: release everything, including a recording still in progress.
  useEffect(
    () => () => {
      const s = sessionRef.current;
      s.discarded = true;
      if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop();
      releaseSession();
      releaseSetupCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [releaseSession],
  );

  // Live self-view bubble: show the session's camera, and track whether it's popped out (Picture-in-Picture).
  useEffect(() => {
    const v = bubbleVideoRef.current;
    if (!v || !liveCam) return;
    v.srcObject = liveCam;
    v.play().catch(() => {});
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);
    v.addEventListener('enterpictureinpicture', onEnter);
    v.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      v.removeEventListener('enterpictureinpicture', onEnter);
      v.removeEventListener('leavepictureinpicture', onLeave);
      setPipActive(false);
    };
  }, [liveCam]);

  /**
   * One composited frame (screen + circular camera bubble), used for window/tab capture in "Screen + Cam".
   * The bubble is drawn at the same place and size as the live bubble on screen, so when this very tab
   * is being recorded the drawn bubble lands exactly on top of the live one (no double bubble).
   */
  const drawFrame = () => {
    const { screenEl, camEl } = sessionRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !screenEl?.videoWidth) return;

    ctx.drawImage(screenEl, 0, 0, canvas.width, canvas.height);
    if (!camEl?.videoWidth) return;

    const area = captureArea(sessionRef.current.surface);
    const scaleX = canvas.width / area.width;
    const scaleY = canvas.height / area.height;
    const half = BUBBLE_SIZE / 2;
    const radius = Math.max(8, Math.round(half * Math.min(scaleX, scaleY)));
    const cx = Math.min(canvas.width - radius, Math.max(radius, (area.left + bubblePosRef.current.x + half) * scaleX));
    const cy = Math.min(canvas.height - radius, Math.max(radius, (area.top + bubblePosRef.current.y + half) * scaleY));

    // Centre-crop the camera to a square, then clip it to a circle.
    const side = Math.min(camEl.videoWidth, camEl.videoHeight);
    const sx = (camEl.videoWidth - side) / 2;
    const sy = (camEl.videoHeight - side) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(camEl, sx, sy, side, side, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, BUBBLE_BORDER * 2 * Math.min(scaleX, scaleY)); // covers the live bubble's border
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  };

  const getMicStream = async (): Promise<MediaStream | null> => {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return null; // recording continues without a microphone
    }
  };

  const finishRecording = () => {
    const s = sessionRef.current;
    if (!s.recorder || s.recorder.state === 'inactive') return;
    durationSecRef.current = Math.min(Math.round(elapsedMs() / 1000), RECORDING_LIMITS.maxDurationSec);
    s.segmentStart = null;
    s.recorder.stop(); // onstop builds the preview, then the session's devices are released
  };

  const startRecording = async () => {
    if (phase !== 'setup') return; // guards double-clicks
    setError(null);
    setPhase('starting');
    const s = (sessionRef.current = emptySession());

    try {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Recording is not supported in this browser.');
      }
      const wantsCamera = mode !== 'screen' && cameraEnabled;

      if (mode !== 'camera') {
        if (!navigator.mediaDevices.getDisplayMedia) throw new Error('Screen recording is not supported in this browser.');
        s.screen = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS);
      }
      if (wantsCamera) {
        s.cam = hasLiveVideo(setupCamRef.current) ? setupCamRef.current : null;
        setupCamRef.current = null; // ownership moves to the session
        if (!s.cam) {
          s.cam = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS }).catch(() => null);
          if (!s.cam) setCameraEnabled(false);
        }
      } else {
        releaseSetupCamera();
      }
      if (!s.screen && !s.cam) throw new Error('No screen or camera source available to record.');

      // Video: record a single source directly (no per-frame work). "Screen + Cam" always goes through the
      // canvas compositor, which draws the camera into every frame (driven by a background-safe ticker so
      // it stays smooth in hidden tabs). Relying on the screen capture to pick up an on-screen bubble is
      // unreliable: floating windows can be left out of the capture, and you may not be looking at Orbit.
      s.surface = (s.screen?.getVideoTracks()[0]?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
      s.composite = !!(s.screen && s.cam);

      let videoTrack: MediaStreamTrack;
      if (s.screen) s.screenEl = await mountSourceVideo(s.screen);
      if (s.cam && (s.composite || !s.screen)) s.camEl = await mountSourceVideo(s.cam); // compositor / camera-only thumbnail

      if (s.composite) {
        const canvas = canvasRef.current!;
        const scale = Math.min(1, MAX_WIDTH / (s.screenEl!.videoWidth || MAX_WIDTH), MAX_HEIGHT / (s.screenEl!.videoHeight || MAX_HEIGHT));
        // Size is locked before captureStream(): resizing a canvas mid-recording corrupts the output.
        canvas.width = Math.round((s.screenEl!.videoWidth || 1280) * scale);
        canvas.height = Math.round((s.screenEl!.videoHeight || 720) * scale);
        ctxRef.current = canvas.getContext('2d', { alpha: false, desynchronized: true });
        drawFrame();
        videoTrack = canvas.captureStream(FPS).getVideoTracks()[0];
      } else {
        videoTrack = (s.screen ?? s.cam)!.getVideoTracks()[0];
      }

      // Audio: tab/system audio and/or microphone. Mixed only when there are two sources.
      if (micEnabled) s.mic = await getMicStream();
      const audioSources = [s.screen, s.mic].filter((x): x is MediaStream => !!x && x.getAudioTracks().length > 0);
      let audioTracks: MediaStreamTrack[] = [];
      if (audioSources.length === 1) {
        audioTracks = audioSources[0].getAudioTracks();
      } else if (audioSources.length > 1) {
        s.audioCtx = new AudioContext();
        const destination = s.audioCtx.createMediaStreamDestination();
        audioSources.forEach((src) => s.audioCtx!.createMediaStreamSource(src).connect(destination));
        audioTracks = destination.stream.getAudioTracks();
      }

      const stream = new MediaStream([videoTrack, ...audioTracks]);
      const mimeType = pickSupportedMimeType();
      const options: MediaRecorderOptions = { videoBitsPerSecond: VIDEO_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { ...options, mimeType } : options);
      } catch {
        recorder = new MediaRecorder(stream); // browser rejected our options: use its defaults
      }
      s.recorder = recorder;
      s.mimeType = recorder.mimeType || mimeType || 'video/webm';

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        releaseSession();
        if (s.discarded) return;
        const blob = new Blob(chunks, { type: s.mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setElapsedSec(durationSecRef.current);
        defaultTitleRef.current = `Recording ${new Date().toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`;
        setPhase('review');
        // No "upload" button: every finished clip goes straight to the Video Library.
        if (blob.size === 0) return markUnsavable('Nothing was recorded. Try again.');
        if (blob.size > RECORDING_LIMITS.maxBytes) {
          return markUnsavable(
            `This clip is larger than ${RECORDING_LIMITS.maxBytes / (1024 * 1024)} MB and can't be uploaded. You can still download it.`,
          );
        }
        void saveToLibrary();
      };

      // Browser's own "Stop sharing" button (or the shared window closing) ends the recording cleanly.
      s.screen?.getVideoTracks()[0]?.addEventListener('ended', finishRecording);

      // One ticker drives the compositor, the on-screen clock, the thumbnail grab and the 5-minute cap.
      let lastShownSec = -1;
      s.stopTicker = createBackgroundTicker(FRAME_MS, () => {
        if (s.segmentStart === null) return; // paused or stopped
        if (s.composite) drawFrame();
        const ms = elapsedMs();
        if (!s.thumbnail && ms >= THUMBNAIL_AT_MS) {
          const source = s.composite ? canvasRef.current : s.screenEl ?? s.camEl;
          s.thumbnail = source ? captureVideoFrame(source) : null;
        }
        const sec = Math.floor(ms / 1000);
        if (sec !== lastShownSec) {
          lastShownSec = sec;
          setElapsedSec(sec);
        }
        if (ms >= MAX_DURATION_MS) finishRecording();
      });

      recorder.start(TIMESLICE_MS);
      s.segmentStart = performance.now();
      setElapsedSec(0);
      setLiveCam(s.cam);
      setPhase('recording');
    } catch (err: any) {
      releaseSession();
      const cancelledPicker = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
      setError(cancelledPicker ? 'Screen sharing was cancelled or blocked.' : err?.message || 'Could not start recording. Check permissions and try again.');
      setPhase('setup');
    }
  };

  const togglePause = () => {
    const s = sessionRef.current;
    if (!s.recorder) return;
    if (s.recorder.state === 'recording') {
      s.recorder.pause();
      s.accumulatedMs = elapsedMs();
      s.segmentStart = null;
      setPhase('paused');
    } else if (s.recorder.state === 'paused') {
      s.recorder.resume();
      s.segmentStart = performance.now();
      setPhase('recording');
    }
  };

  const discardAndClose = () => {
    const s = sessionRef.current;
    s.discarded = true;
    if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop();
    releaseSession();
    releaseSetupCamera();
    onClose();
  };

  // ---- Saving (refs only: these also run from recorder.onstop, whose closure is from an older render) ----

  const markUnsavable = (message: string) => {
    setError(message);
    setSaveState('unsavable');
  };

  /** Uploads the finished clip to the workspace Video Library (no channel). */
  const saveToLibrary = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setSaveState('uploading');
    setError(null);
    try {
      const ext = blob.type.startsWith('video/mp4') ? 'mp4' : 'webm';
      // @fastify/multipart parses text fields as the stream advances, so fields must precede the file.
      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      formData.append('title', titleRef.current.trim() || defaultTitleRef.current);
      formData.append('durationSec', String(durationSecRef.current));
      const thumbnail =
        sessionRef.current.thumbnail ?? (previewVideoRef.current ? captureVideoFrame(previewVideoRef.current) : null);
      if (thumbnail) formData.append('thumbnailDataUrl', thumbnail);
      formData.append('file', blob, `recording.${ext}`);

      const res = await api.post<Recording>('/api/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      savedRef.current = res.data;
      setSaved(res.data);
      setSaveState('saved');
      await commitTitle(); // a title typed while the upload was running
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save the recording. Check your connection and retry.');
      setSaveState('failed');
    }
  };

  /** Saves the title field onto the uploaded clip (blur, Enter, Share, Done). Failures keep the old title. */
  const commitTitle = async () => {
    const rec = savedRef.current;
    const next = titleRef.current.trim().slice(0, 200);
    if (!rec || !next || next === rec.title) return;
    savedRef.current = { ...rec, title: next }; // optimistic: repeated commits don't send twice
    try {
      const res = await api.patch<Recording>(`/api/recordings/${rec.id}`, { title: next });
      savedRef.current = res.data;
      setSaved(res.data);
    } catch {
      savedRef.current = rec;
    }
  };

  // Post the saved clip into the chosen conversation as a message (chat renders it as a player).
  const shareInOrbit = async (target: ShareTarget) => {
    const rec = savedRef.current;
    if (!rec || busy) return;
    setShareOpen(false);
    setBusy('share');
    setError(null);
    try {
      await commitTitle();
      const channelId =
        target.kind === 'channel'
          ? target.channel.id
          : (await api.post<Channel>(`/api/channels/workspaces/${workspaceId}/dm`, { targetUserId: target.userId })).data.id;
      const message = await api.post(`/api/channels/${channelId}/messages`, { content: clipShareUrl(rec.shareSlug) });
      // Link the clip to its message; it's already posted, so a failure here isn't fatal.
      if (message.data?.id) {
        await api.post(`/api/recordings/${rec.id}/attach`, { messageId: message.data.id }).catch(() => {});
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to share recording');
      setBusy(null);
    }
  };

  /** A bad take: it was saved automatically, so "delete" removes it from the library too. */
  const deleteClip = async () => {
    const rec = savedRef.current;
    if (!rec || busy || !confirm('Delete this recording? It will be removed from the Video Library.')) return;
    setBusy('delete');
    try {
      await api.delete(`/api/recordings/${rec.id}`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete recording');
      setBusy(null);
    }
  };

  const closeReview = () => {
    void commitTitle();
    onClose();
  };

  // Pop the live camera out into a floating window that stays on top of other apps (Picture-in-Picture).
  const pipSupported = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;
  const togglePip = async () => {
    const v = bubbleVideoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* blocked or unsupported: the on-page bubble keeps working */
    }
  };

  // The live camera bubble is draggable; in "Screen + Cam" its position is where the camera appears in the video.
  const onBubblePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, offsetX: e.clientX - bubblePos.x, offsetY: e.clientY - bubblePos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBubblePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const next = {
      x: Math.min(Math.max(0, e.clientX - dragRef.current.offsetX), window.innerWidth - BUBBLE_SIZE),
      y: Math.min(Math.max(0, e.clientY - dragRef.current.offsetY), window.innerHeight - BUBBLE_SIZE),
    };
    bubblePosRef.current = next;
    setBubblePos(next);
  };
  const onBubblePointerUp = () => {
    dragRef.current.dragging = false;
  };

  const isLive = phase === 'recording' || phase === 'paused';
  const remainingSec = RECORDING_LIMITS.maxDurationSec - elapsedSec;
  const nearLimit = isLive && remainingSec <= WARN_REMAINING_SEC;
  const isReview = phase === 'review';
  const uploading = isReview && saveState === 'uploading';
  const downloadName = `${(title.trim() || defaultTitleRef.current).replace(/[\\/:*?"<>|]+/g, '-')}.${
    blobRef.current?.type.startsWith('video/mp4') ? 'mp4' : 'webm'
  }`;
  const secondaryBtn =
    'flex items-center gap-1.5 px-3 py-1.5 border border-[var(--theme-border)] text-[var(--theme-text)] bg-[var(--theme-bg-app)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg text-xs font-semibold transition disabled:opacity-50';

  // Timer + Pause / pop-out camera / Stop / Cancel.
  const controlBar = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-mono text-red-500">
        <span className={`w-2 h-2 rounded-full bg-red-500 ${phase === 'recording' ? 'animate-pulse' : ''}`} />
        {phase === 'paused' ? 'PAUSED' : 'REC'} {formatDuration(elapsedSec)}
        <span className={nearLimit ? 'font-bold' : 'text-[var(--theme-text-muted)]'}>
          / {formatDuration(RECORDING_LIMITS.maxDurationSec)}
        </span>
      </span>
      {nearLimit && <span className="text-[11px] font-semibold text-red-500">{remainingSec}s left</span>}
      <span className="w-px h-5 bg-[var(--theme-border)]" />
      <button
        onClick={togglePause}
        title={phase === 'paused' ? 'Resume' : 'Pause'}
        className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-full transition"
      >
        {phase === 'paused' ? <Play size={15} /> : <Pause size={15} />}
      </button>
      {/* Pop the camera out to see yourself over other apps */}
      {liveCam && pipSupported && (
        <button
          onClick={togglePip}
          title={pipActive ? 'Bring the camera back into Orbit' : 'Pop the camera out so you can see yourself over other apps'}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full text-xs transition ${
            pipActive
              ? 'text-slack-green bg-slack-green/10'
              : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]'
          }`}
        >
          <PictureInPicture2 size={15} />
        </button>
      )}
      <button
        onClick={finishRecording}
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
    </>
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Compositor canvas. Off-screen rather than display:none, which can stop Chrome repainting it
          and make captureStream() emit frozen frames. */}
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: '-99999px', opacity: 0, pointerEvents: 'none' }} />

      {/* Setup / preview / upload card — hidden while live so it doesn't block the screen being recorded */}
      {!isLive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          {/* No overflow-hidden: the "Share in Orbit" menu must be able to extend past the card. */}
          <div className="w-full max-w-lg bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-slack-green" />
                <span className="text-sm font-semibold text-[var(--theme-text)]">Record a clip</span>
                <span className="text-[11px] text-[var(--theme-text-muted)]">
                  up to {RECORDING_LIMITS.maxDurationSec / 60} min
                </span>
              </div>
              <button
                onClick={isReview ? closeReview : discardAndClose}
                disabled={uploading || !!busy}
                title={uploading ? 'Saving to the Video Library...' : 'Close'}
                className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
              )}

              {(phase === 'setup' || phase === 'starting') && (
                <div className="flex flex-col items-center gap-4 py-6">
                  {mode !== 'screen' && cameraEnabled && (
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[var(--theme-border)] bg-black">
                      <video ref={setupPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl p-1">
                    {([
                      { key: 'screen', label: 'Screen', icon: Monitor },
                      { key: 'screen+camera', label: 'Screen + Cam', icon: CameraIcon },
                      { key: 'camera', label: 'Camera', icon: CameraIcon },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        disabled={phase === 'starting'}
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
                      disabled={mode === 'screen' || phase === 'starting'}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${
                        cameraEnabled ? 'border-slack-green text-slack-green bg-slack-green/10' : 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                      }`}
                    >
                      {cameraEnabled ? <CameraIcon size={14} /> : <VideoOff size={14} />}
                      {cameraEnabled ? 'Camera on' : 'Camera off'}
                    </button>
                    <button
                      onClick={() => setMicEnabled((v) => !v)}
                      disabled={phase === 'starting'}
                      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
                        micEnabled ? 'border-slack-green text-slack-green bg-slack-green/10' : 'border-[var(--theme-border)] text-[var(--theme-text-muted)]'
                      }`}
                    >
                      {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                      {micEnabled ? 'Microphone on' : 'Microphone off'}
                    </button>
                  </div>

                  <p className="text-xs text-[var(--theme-text-muted)] text-center max-w-xs">
                    {mode === 'camera'
                      ? "You'll record from your webcam only."
                      : 'Your browser will ask you to pick a screen, window, or tab to share. Recording starts immediately after.'}{' '}
                    Recordings stop automatically at {RECORDING_LIMITS.maxDurationSec / 60} minutes.
                  </p>

                  <button
                    onClick={startRecording}
                    disabled={phase === 'starting'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slack-green hover:bg-slack-green/90 text-white rounded-xl font-semibold text-sm transition disabled:opacity-60"
                  >
                    {phase === 'starting' ? <Loader2 size={14} className="animate-spin" /> : <Circle size={14} className="fill-white" />}
                    {phase === 'starting' ? 'Starting...' : 'Start recording'}
                  </button>
                </div>
              )}

              {isReview && previewUrl && (
                <div className="flex flex-col gap-3">
                  <video ref={previewVideoRef} src={previewUrl} controls playsInline className="w-full rounded-lg bg-black max-h-60" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => void commitTitle()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    placeholder={defaultTitleRef.current}
                    maxLength={200}
                    disabled={!!busy}
                    className="text-sm bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-slack-green"
                  />

                  {/* Save status: the clip uploads to the Video Library by itself as soon as recording stops */}
                  <div className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)]">
                    <span className="font-mono">{formatDuration(elapsedSec)}</span>
                    <span>·</span>
                    {saveState === 'uploading' && (
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Saving to Video Library...
                      </span>
                    )}
                    {saveState === 'saved' && (
                      <span className="flex items-center gap-1.5 text-slack-green font-semibold">
                        <Check size={13} /> Saved to Video Library
                      </span>
                    )}
                    {saveState === 'failed' && <span className="text-red-500">Not saved</span>}
                    {saveState === 'unsavable' && <span className="text-red-500">Can't be uploaded</span>}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {saveState === 'saved' && (
                        <button onClick={deleteClip} disabled={!!busy} title="Delete this recording" className={secondaryBtn}>
                          {busy === 'delete' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Delete
                        </button>
                      )}
                      {(saveState === 'failed' || saveState === 'unsavable') && (
                        <a href={previewUrl} download={downloadName} className={secondaryBtn}>
                          <Download size={13} /> Download
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {saveState === 'failed' && (
                        <button onClick={() => void saveToLibrary()} className={secondaryBtn}>
                          <RotateCcw size={13} /> Retry
                        </button>
                      )}
                      {saveState !== 'unsavable' && saveState !== 'failed' && (
                        <div className="relative">
                          <button
                            onClick={() => setShareOpen((v) => !v)}
                            disabled={saveState !== 'saved' || !!busy}
                            title={saveState === 'saved' ? 'Post this clip in a channel or DM' : 'Available once saved'}
                            aria-haspopup="listbox"
                            aria-expanded={shareOpen}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-slack-green hover:bg-slack-green/90 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60"
                          >
                            {busy === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {busy === 'share' ? 'Sharing...' : 'Share in Orbit'}
                            {busy !== 'share' && <ChevronDown size={13} />}
                          </button>
                          {shareOpen && (
                            <ShareTargetMenu
                              channels={channels}
                              members={members}
                              currentUserId={currentUserId}
                              suggestedChannelId={suggestedChannelId}
                              onPick={shareInOrbit}
                              onClose={() => setShareOpen(false)}
                            />
                          )}
                        </div>
                      )}
                      <button
                        onClick={saveState === 'saved' ? closeReview : discardAndClose}
                        disabled={uploading || !!busy}
                        className={secondaryBtn}
                      >
                        {saveState === 'saved' || uploading ? 'Done' : 'Discard'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live camera bubble: you see yourself the whole time. Drag it anywhere. In "Screen + Cam" its
          position is where the camera appears in the video. While popped out it's kept mounted but hidden
          (the floating window plays from this element), so it isn't captured twice. */}
      {isLive && liveCam && (
        <div
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
          style={{ left: bubblePos.x, top: bubblePos.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderWidth: BUBBLE_BORDER }}
          className={`fixed rounded-full overflow-hidden border-white/90 bg-black shadow-2xl cursor-move touch-none ${
            pipActive ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <video ref={bubbleVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1] pointer-events-none" />
        </div>
      )}

      {/* Floating control bar */}
      {isLive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] shadow-2xl rounded-full px-4 py-2 pointer-events-auto">
          {controlBar}
        </div>
      )}
    </div>
  );
};

/**
 * "Share in Orbit" picker: the user's channels plus a DM with any workspace member. The conversation
 * the recorder was opened from is listed first. Anonymous channels are left out — a recording carries
 * its creator, which would unmask the poster (the server refuses them too).
 */
const ShareTargetMenu: React.FC<{
  channels: Channel[];
  members: WorkspaceMember[];
  currentUserId?: string;
  suggestedChannelId?: string;
  onPick: (target: ShareTarget) => void;
  onClose: () => void;
}> = ({ channels, members, currentUserId, suggestedChannelId, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // The toggle button is the menu's sibling; let its own click handle toggling.
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
  const suggested = useMemo(() => {
    const c = channels.find((x) => x.id === suggestedChannelId);
    if (!c || c.isAnonymous || c.isArchived) return null;
    if (c.type !== 'DIRECT') return { label: c.name, target: { kind: 'channel', channel: c } as ShareTarget, isPrivate: c.type === 'PRIVATE' };
    const peer = c.members?.find((m) => m.userId !== currentUserId);
    const name = peer?.user?.displayName || peer?.user?.username;
    return name ? { label: name, target: { kind: 'channel', channel: c } as ShareTarget, isPrivate: true } : null;
  }, [channels, suggestedChannelId, currentUserId]);

  const channelTargets = useMemo(
    () =>
      channels
        .filter((c) => c.type !== 'DIRECT' && !c.isAnonymous && !c.isArchived && c.id !== suggestedChannelId)
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [channels, q, suggestedChannelId],
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
  const showSuggested = suggested && (!q || suggested.label.toLowerCase().includes(q));

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
        {showSuggested && (
          <>
            <div className={heading}>Current conversation</div>
            <button type="button" role="option" aria-selected={false} className={row} onClick={() => onPick(suggested!.target)}>
              {suggested!.isPrivate ? <Lock size={13} className="shrink-0 opacity-70" /> : <Hash size={13} className="shrink-0 opacity-70" />}
              <span className="truncate">{suggested!.label}</span>
            </button>
          </>
        )}
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
        {!showSuggested && channelTargets.length === 0 && dmTargets.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-[var(--theme-text-muted)]">No matches</p>
        )}
      </div>
    </div>
  );
};
