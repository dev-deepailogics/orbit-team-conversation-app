import { create } from 'zustand';

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

  startHuddle: (channelId: string, channelName: string, token: string, serverUrl: string) => void;
  leaveHuddle: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleMinimized: () => void;
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

  startHuddle: (channelId, channelName, token, serverUrl) =>
    set({
      isActive: true,
      channelId,
      channelName,
      token,
      serverUrl,
      isMinimized: false,
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
}));
