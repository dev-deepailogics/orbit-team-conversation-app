'use client';

import React from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Minimize2, Maximize2, X, PhoneCall } from 'lucide-react';
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
            className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={leaveHuddle}
            className="p-1 hover:bg-red-500/20 rounded text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
      <div className="bg-[#1A1D21] border border-gray-700 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Call Header */}
        <div className="h-14 border-b border-gray-800 px-6 flex items-center justify-between bg-[#1F2326]">
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

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimized}
              title="Minimize to floating widget"
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
            >
              <Minimize2 size={18} />
            </button>
            <button
              onClick={leaveHuddle}
              title="Leave Call"
              className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* LiveKit WebRTC Video/Audio Conference Area */}
        <div className="flex-1 bg-black/90 relative overflow-hidden flex flex-col">
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
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
};
