'use client';

import React, { useEffect } from 'react';
import { PhoneCall, PhoneOff, Video } from 'lucide-react';
import { useHuddleStore } from '../../stores/huddleStore';
import { sounds } from '../../lib/sound';

interface IncomingCallDialogProps {
  onAcceptCall: (channelId: string, channelName: string) => void;
}

export const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({ onAcceptCall }) => {
  const { incomingCall, dismissIncomingCall, isActive } = useHuddleStore();

  useEffect(() => {
    if (incomingCall && !isActive) {
      sounds.startCallRing();
    } else {
      sounds.stopCallRing();
    }

    return () => {
      sounds.stopCallRing();
    };
  }, [incomingCall, isActive]);

  if (!incomingCall || isActive) return null;

  const title = incomingCall.channelType === 'DIRECT'
    ? `Incoming Call from ${incomingCall.callerName}`
    : `${incomingCall.callerName} started a Call in #${incomingCall.channelName}`;

  return (
    <div className="fixed top-3 right-3 left-3 sm:left-auto sm:top-6 sm:right-6 z-50 animate-bounce-short">
      <div className="bg-[#1F2326] border-2 border-slack-green shadow-2xl rounded-2xl p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 max-w-sm backdrop-blur">
        {/* Caller Avatar with pulsing ring */}
        <div className="relative">
          <img
            src={incomingCall.callerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${incomingCall.callerName}`}
            alt={incomingCall.callerName}
            className="w-12 h-12 rounded-xl object-cover ring-2 ring-slack-green"
          />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-slack-green rounded-full flex items-center justify-center text-white animate-pulse">
            <Video size={10} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate leading-snug">
            {title}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">LiveKit Voice / Video / Screen</p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                const { channelId, channelName } = incomingCall;
                sounds.stopCallRing();
                dismissIncomingCall();
                onAcceptCall(channelId, channelName);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg transition shadow-md"
            >
              <PhoneCall size={13} />
              <span>Join Call</span>
            </button>

            <button
              onClick={() => {
                sounds.stopCallRing();
                dismissIncomingCall();
              }}
              className="px-3 py-1.5 bg-[#2C3136] hover:bg-red-500/20 text-gray-300 hover:text-red-400 text-xs font-semibold rounded-lg border border-gray-700 transition"
            >
              <PhoneOff size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
