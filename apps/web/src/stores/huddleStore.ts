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

export interface HuddleParticipantInfo {
  identity: string;
  name: string;
  joinedAt?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  user?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
}

interface HuddleState {
  isActive: boolean;
  channelId: string | null;
  channelName: string | null;
  workspaceId: string | null;
  token: string | null;
  serverUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  incomingCall: IncomingCallInfo | null;
  activeParticipants: HuddleParticipantInfo[];
  // Map of channelId -> list of active participant users
  channelActiveParticipants: Record<string, HuddleParticipantInfo[]>;

  startHuddle: (channelId: string, channelName: string, token: string, serverUrl: string, workspaceId?: string) => void;
  leaveHuddle: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleMinimized: () => void;
  setIncomingCall: (call: IncomingCallInfo | null) => void;
  dismissIncomingCall: () => void;
  setActiveParticipants: (participants: HuddleParticipantInfo[]) => void;
  addChannelParticipant: (channelId: string, participant: HuddleParticipantInfo) => void;
  removeChannelParticipant: (channelId: string, userId: string) => void;
  clearChannelParticipants: (channelId: string) => void;
}

export const useHuddleStore = create<HuddleState>((set) => ({
  isActive: false,
  channelId: null,
  channelName: null,
  workspaceId: null,
  token: null,
  serverUrl: null,
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,
  isMinimized: false,
  incomingCall: null,
  activeParticipants: [],
  channelActiveParticipants: {},

  startHuddle: (channelId, channelName, token, serverUrl, workspaceId) =>
    set({
      isActive: true,
      channelId,
      channelName,
      workspaceId: workspaceId || null,
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
      workspaceId: null,
      token: null,
      serverUrl: null,
      isScreenSharing: false,
      isMinimized: false,
      activeParticipants: [],
    }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoOn: !state.isVideoOn })),
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
  setIncomingCall: (call) => set({ incomingCall: call }),
  dismissIncomingCall: () => set({ incomingCall: null }),
  setActiveParticipants: (participants) => set({ activeParticipants: participants }),

  addChannelParticipant: (channelId, participant) =>
    set((state) => {
      const current = state.channelActiveParticipants[channelId] || [];
      if (current.some((p) => p.identity === participant.identity)) {
        return state;
      }
      return {
        channelActiveParticipants: {
          ...state.channelActiveParticipants,
          [channelId]: [...current, participant],
        },
      };
    }),

  removeChannelParticipant: (channelId, userId) =>
    set((state) => {
      const current = state.channelActiveParticipants[channelId] || [];
      return {
        channelActiveParticipants: {
          ...state.channelActiveParticipants,
          [channelId]: current.filter((p) => p.identity !== userId),
        },
      };
    }),

  clearChannelParticipants: (channelId) =>
    set((state) => {
      const updated = { ...state.channelActiveParticipants };
      delete updated[channelId];
      return { channelActiveParticipants: updated };
    }),
}));

