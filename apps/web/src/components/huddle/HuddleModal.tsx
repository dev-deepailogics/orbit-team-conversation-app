'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import {
  Minus,
  Expand,
  Shrink,
  X,
  PhoneCall,
  Maximize2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Monitor,
  MessageSquare,
} from 'lucide-react';

import { useHuddleStore } from '../../stores/huddleStore';
import { ModernMeetingChat } from './ModernMeetingChat';


// Screen Share Mini-Preview for Minimized Floating Dock
const MinimizedFloatingWidget: React.FC<{
  channelName: string | null;
  toggleMinimized: () => void;
  handleLeave: () => void;
}> = ({ channelName, toggleMinimized, handleLeave }) => {
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const activeScreenShare = screenTracks.find(
    (t) => t.publication?.isSubscribed && !t.publication?.isMuted
  ) || screenTracks[0];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col bg-[#14181D]/95 border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl rounded-2xl p-2.5 sm:p-3 gap-2.5 animate-fade-in hover:border-emerald-500/30 transition-all group max-w-xs sm:max-w-sm">
      {/* Live Screen Share Video Thumbnail if someone is presenting */}
      {activeScreenShare ? (
        <div
          onClick={toggleMinimized}
          className="relative w-64 h-36 bg-black/90 rounded-xl overflow-hidden border border-white/10 cursor-pointer group/thumb shadow-inner"
          title="Click to expand screen share"
        >
          <VideoTrack trackRef={activeScreenShare} className="w-full h-full object-contain" />
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5 text-[10px] text-white font-medium">
            <Monitor size={11} className="text-emerald-400" />
            <span className="truncate max-w-[120px]">
              {activeScreenShare.participant.name || activeScreenShare.participant.identity}
            </span>
          </div>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold shadow-lg flex items-center gap-1">
              <Maximize2 size={13} />
              Expand
            </span>
          </div>
        </div>
      ) : null}

      {/* Dock Bottom Info & Actions */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Channel and Active Indicator */}
        <div
          onClick={toggleMinimized}
          className="flex items-center gap-2.5 cursor-pointer pr-1 min-w-0"
          title="Click to expand call window"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              {activeScreenShare ? <Monitor size={15} /> : <PhoneCall size={15} />}
            </div>
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-xs font-bold text-white block truncate leading-tight">
              #{channelName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">
                {activeScreenShare ? 'Screen Sharing' : 'Connected'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1 pl-2 border-l border-white/10 shrink-0">
          <button
            onClick={toggleMinimized}
            title="Expand Huddle"
            className="p-1.5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition active:scale-95"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={handleLeave}
            title="Leave Huddle"
            className="p-1.5 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition active:scale-95"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const HuddleModal: React.FC = () => {
  const {
    isActive,
    channelName,
    token,
    serverUrl,
    isMinimized,
    leaveHuddle,
    toggleMinimized,
  } = useHuddleStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);


  // Sync state with browser Fullscreen API (e.g. Esc key or F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Fallback to CSS viewport fullscreen if API rejected or unsupported
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  // Keyboard shortcut: Press 'F' to toggle Fullscreen, Escape to exit
  useEffect(() => {
    if (!isActive || isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }

      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isMinimized, isFullscreen, toggleFullscreen]);

  const handleLeave = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);

    const { channelId, workspaceId } = useHuddleStore.getState();
    if (channelId && typeof window !== 'undefined') {
      import('../../lib/socket').then(({ getSocket }) => {
        const socket = getSocket();
        if (socket) {
          socket.emit('huddle:left', {
            channelId,
            workspaceId: workspaceId || '',
          });
        }
      });
      // Call backend to leave
      import('../../lib/api').then(({ api }) => {
        api.post(`/api/huddles/${channelId}/end`).catch(() => {});
      });
    }

    leaveHuddle();
  };

  const handleMinimize = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    toggleMinimized();
  };

  if (!isActive || !token || !serverUrl) return null;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      onDisconnected={handleLeave}
      onError={(err) => {
        console.error('LiveKit Room error:', err);
        handleLeave();
      }}
      data-lk-theme="default"
      style={{ display: 'contents' }}
    >
      {/* 1. Minimized Floating Widget with Screen Share Live Preview */}
      {isMinimized && (
        <MinimizedFloatingWidget
          channelName={channelName}
          toggleMinimized={toggleMinimized}
          handleLeave={handleLeave}
        />
      )}

      {/* 2. Main Conference Modal (Hidden when minimized, but LiveKitRoom stays connected in DOM) */}
      <div
        ref={containerRef}
        style={{ display: isMinimized ? 'none' : 'flex' }}
        className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full bg-[#0A0C0E] p-0'
            : 'bg-black/75 backdrop-blur-xl items-center justify-center p-3 sm:p-6'
        }`}
      >
        <div
          className={`flex flex-col overflow-hidden transition-all duration-300 ${
            isFullscreen
              ? 'w-full h-full rounded-none border-0 shadow-none bg-[#0A0C0E]'
              : 'border border-white/10 rounded-3xl w-full max-w-6xl h-[92vh] sm:h-[84vh] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[#161A1F]/90 to-[#0F1216]/95 backdrop-blur-2xl'
          }`}
        >
          {/* Luxury Glass Header */}
          <div
            onDoubleClick={toggleFullscreen}
            title="Double-click header to toggle Full Screen"
            className="h-16 border-b border-white/[0.08] px-5 sm:px-8 flex items-center justify-between bg-white/[0.02] backdrop-blur-md select-none shrink-0"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <PhoneCall size={19} />
                </div>
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                    #{channelName}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    Encrypted HD
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Ultra-low latency audio, video & screen share</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Chat Button */}
              <button
                onClick={() => setIsChatOpen((prev) => !prev)}
                title={isChatOpen ? 'Hide in-call chat' : 'Open in-call chat'}
                className={`p-2.5 rounded-xl transition-all active:scale-95 border flex items-center gap-1.5 text-xs font-semibold ${
                  isChatOpen
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'hover:bg-white/[0.08] text-slate-300 hover:text-white border-transparent hover:border-white/10'
                }`}
              >
                <MessageSquare size={17} />
                <span className="hidden sm:inline">Chat</span>
              </button>

              {/* Minimize to Floating Widget */}
              <button
                onClick={handleMinimize}
                title="Minimize to floating widget"
                className="p-2.5 hover:bg-white/[0.08] rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 border border-transparent hover:border-white/10"
              >
                <Minus size={18} />
              </button>

              {/* Toggle Full Screen */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Full Screen (F or Esc)' : 'Full Screen (F)'}
                className="p-2.5 hover:bg-white/[0.08] rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 border border-transparent hover:border-white/10"
              >
                {isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}
              </button>

              {/* Leave Call */}
              <button
                onClick={handleLeave}
                title="Leave Call"
                className="px-3.5 py-1.5 ml-1 bg-gradient-to-r from-red-500/20 to-red-600/30 hover:from-red-500/30 hover:to-red-600/40 border border-red-500/30 text-red-300 hover:text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <X size={15} />
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* LiveKit WebRTC Video/Audio Conference Area + Modern Meeting Chat */}
          <div className="flex-1 bg-transparent relative overflow-hidden flex flex-row min-h-0 w-full">
            <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
              <VideoConference />
              <RoomAudioRenderer />
            </div>

            {/* Custom Modern Meeting Chat Panel */}
            <ModernMeetingChat
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        </div>
      </div>
    </LiveKitRoom>
  );
};



