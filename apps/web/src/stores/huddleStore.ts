import { create } from 'zustand';

export interface IncomingCallInfo {
  channelId: string;
  channelName: string;
  channelType?: string;
  channelTopic?: string;
  callerName: string;
  callerAvatar?: string;
  callerId: string;
}

interface HuddleState {
  isActive: boolean;
  channelId: string | null;
  channelName: string | null;
  token: string | null;
  serverUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  incomingCall: IncomingCallInfo | null;

  startHuddle: (channelId: string, channelName: string, token: string, serverUrl: string) => void;
  leaveHuddle: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleMinimized: () => void;
  setIncomingCall: (call: IncomingCallInfo | null) => void;
  dismissIncomingCall: () => void;
}

export const useHuddleStore = create<HuddleState>((set) => ({
  isActive: false,
  channelId: null,
  channelName: null,
  token: null,
  serverUrl: null,
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,
  isMinimized: false,
  incomingCall: null,

  startHuddle: (channelId, channelName, token, serverUrl) =>
    set({
      isActive: true,
      channelId,
      channelName,
      token,
      serverUrl,
      isMinimized: false,
      incomingCall: null,
    }),

  leaveHuddle: () =>
    set({
      isActive: false,
      channelId: null,
      channelName: null,
      token: null,
      serverUrl: null,
      isScreenSharing: false,
      isMinimized: false,
    }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoOn: !state.isVideoOn })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
  setIncomingCall: (call) => set({ incomingCall: call }),
  dismissIncomingCall: () => set({ incomingCall: null }),
}));
