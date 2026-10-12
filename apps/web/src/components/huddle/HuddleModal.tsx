'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
  Minus,
  Expand,
  Shrink,
  X,
  PhoneCall,
  Maximize2,
} from 'lucide-react';
import { useHuddleStore } from '../../stores/huddleStore';

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

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1F2326] border border-slack-green/50 shadow-2xl rounded-xl p-3 z-50 flex items-center gap-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slack-green rounded-full animate-ping" />
          <span className="text-xs font-semibold text-white">
            Call in #{channelName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimized}
            title="Expand Call"
            className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={leaveHuddle}
            title="Leave Call"
            className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'w-full h-full bg-[#1A1D21] p-0'
          : 'bg-black/80 backdrop-blur-md items-center justify-center p-2 sm:p-6'
      }`}
    >
      <div
        className={`bg-[#1A1D21] flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none border-0 shadow-none'
            : 'border border-gray-700 rounded-2xl w-full max-w-5xl h-[92vh] sm:h-[80vh] shadow-2xl'
        }`}
      >
        {/* Call Header */}
        <div
          onDoubleClick={toggleFullscreen}
          title="Double-click header to toggle Full Screen"
          className="h-14 border-b border-gray-800 px-3.5 sm:px-6 flex items-center justify-between bg-[#1F2326] select-none shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slack-green/20 rounded-lg text-slack-green">
              <PhoneCall size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Call in #{channelName}
              </h2>
              <p className="text-[11px] text-gray-400">Audio, Video & Screen Sharing</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Minimize to Widget */}
            <button
              onClick={handleMinimize}
              title="Minimize to floating widget"
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition active:scale-95"
            >
              <Minus size={18} />
            </button>

            {/* Toggle Full Screen */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Full Screen (F or Esc)' : 'Full Screen (F)'}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition active:scale-95"
            >
              {isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}
            </button>

            {/* Leave Call */}
            <button
              onClick={handleLeave}
              title="Leave Call"
              className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition active:scale-95 ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* LiveKit WebRTC Video/Audio Conference Area */}
        <div className="flex-1 bg-black/90 relative overflow-hidden flex flex-col min-h-0 w-full">
          <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            onDisconnected={() => {
              console.log('LiveKit disconnected');
            }}
            onError={(err) => {
              console.error('LiveKit Room error:', err);
            }}
            data-lk-theme="default"
            style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
};
