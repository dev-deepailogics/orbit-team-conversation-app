import { create } from "zustand";
import { api } from "../lib/api";

export interface WorkspacePins {
  channels: string[];
  users: string[];
  projects: string[];
}

interface PinnedState {
  // Keyed by workspaceId
  workspacePins: Record<string, WorkspacePins>;
  userId: string | null;

  getPinnedChannels: (workspaceId: string) => string[];
  getPinnedUsers: (workspaceId: string) => string[];
  getPinnedProjects: (workspaceId: string) => string[];

  isChannelPinned: (workspaceId: string, channelId: string) => boolean;
  isUserPinned: (workspaceId: string, userId: string) => boolean;
  isProjectPinned: (workspaceId: string, projectId: string) => boolean;

  togglePinChannel: (workspaceId: string, channelId: string) => void;
  togglePinUser: (workspaceId: string, targetUserId: string) => void;
  togglePinProject: (workspaceId: string, projectId: string) => void;

  initPins: (workspaceId: string, currentUserId: string, serverSettings?: any) => void;
}

const getStorageKey = (workspaceId: string, userId: string) =>
  `orbit_pins_${workspaceId}_${userId}`;

const loadFromStorage = (workspaceId: string, userId: string): WorkspacePins | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(workspaceId, userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        channels: Array.isArray(parsed.channels) ? parsed.channels : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      };
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
};

const saveToStorage = (workspaceId: string, userId: string, pins: WorkspacePins) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(workspaceId, userId), JSON.stringify(pins));
  } catch {
    // Ignore storage quota errors
  }
};

const syncToServer = async (workspaceId: string, pins: WorkspacePins) => {
  try {
    await api.patch(`/api/workspaces/${workspaceId}/member-settings`, { pins });
  } catch (err) {
    // Silent fail; localStorage already has it
    console.debug("Failed to sync pins to server", err);
  }
};

const EMPTY_PINS: string[] = [];

export const usePinStore = create<PinnedState>((set, get) => ({
  workspacePins: {},
  userId: null,

  getPinnedChannels: (workspaceId: string) => {
    return get().workspacePins[workspaceId]?.channels || EMPTY_PINS;
  },

  getPinnedUsers: (workspaceId: string) => {
    return get().workspacePins[workspaceId]?.users || EMPTY_PINS;
  },

  getPinnedProjects: (workspaceId: string) => {
    return get().workspacePins[workspaceId]?.projects || EMPTY_PINS;
  },

  isChannelPinned: (workspaceId: string, channelId: string) => {
    return (get().workspacePins[workspaceId]?.channels || []).includes(channelId);
  },

  isUserPinned: (workspaceId: string, targetUserId: string) => {
    return (get().workspacePins[workspaceId]?.users || []).includes(targetUserId);
  },

  isProjectPinned: (workspaceId: string, projectId: string) => {
    return (get().workspacePins[workspaceId]?.projects || []).includes(projectId);
  },

  togglePinChannel: (workspaceId: string, channelId: string) => {
    if (!workspaceId || !channelId) return;
    const current = get().workspacePins[workspaceId] || { channels: [], users: [], projects: [] };
    const exists = current.channels.includes(channelId);
    const updatedChannels = exists
      ? current.channels.filter((id) => id !== channelId)
      : [channelId, ...current.channels]; // Put newly pinned at the top

    const nextPins: WorkspacePins = {
      ...current,
      channels: updatedChannels,
    };

    set((state) => ({
      workspacePins: {
        ...state.workspacePins,
        [workspaceId]: nextPins,
      },
    }));

    const uid = get().userId;
    if (uid) {
      saveToStorage(workspaceId, uid, nextPins);
      syncToServer(workspaceId, nextPins);
    }
  },

  togglePinUser: (workspaceId: string, targetUserId: string) => {
    if (!workspaceId || !targetUserId) return;
    const current = get().workspacePins[workspaceId] || { channels: [], users: [], projects: [] };
    const exists = current.users.includes(targetUserId);
    const updatedUsers = exists
      ? current.users.filter((id) => id !== targetUserId)
      : [targetUserId, ...current.users]; // Put newly pinned at the top

    const nextPins: WorkspacePins = {
      ...current,
      users: updatedUsers,
    };

    set((state) => ({
      workspacePins: {
        ...state.workspacePins,
        [workspaceId]: nextPins,
      },
    }));

    const uid = get().userId;
    if (uid) {
      saveToStorage(workspaceId, uid, nextPins);
      syncToServer(workspaceId, nextPins);
    }
  },

  togglePinProject: (workspaceId: string, projectId: string) => {
    if (!workspaceId || !projectId) return;
    const current = get().workspacePins[workspaceId] || { channels: [], users: [], projects: [] };
    const exists = current.projects.includes(projectId);
    const updatedProjects = exists
      ? current.projects.filter((id) => id !== projectId)
      : [projectId, ...current.projects]; // Put newly pinned at the top

    const nextPins: WorkspacePins = {
      ...current,
      projects: updatedProjects,
    };

    set((state) => ({
      workspacePins: {
        ...state.workspacePins,
        [workspaceId]: nextPins,
      },
    }));

    const uid = get().userId;
    if (uid) {
      saveToStorage(workspaceId, uid, nextPins);
      syncToServer(workspaceId, nextPins);
    }
  },

  initPins: (workspaceId: string, currentUserId: string, serverSettings?: any) => {
    if (!workspaceId || !currentUserId) return;

    // 1. Try local storage first (instant synchronous)
    const local = loadFromStorage(workspaceId, currentUserId);

    // 2. Server settings (if any)
    const serverPins = serverSettings?.pins;

    let merged: WorkspacePins = {
      channels: [],
      users: [],
      projects: [],
    };

    if (local && serverPins) {
      // Merge unique maintaining order
      const channelSet = new Set([...local.channels, ...(serverPins.channels || [])]);
      const userSet = new Set([...local.users, ...(serverPins.users || [])]);
      const projectSet = new Set([...local.projects, ...(serverPins.projects || [])]);
      merged = {
        channels: Array.from(channelSet),
        users: Array.from(userSet),
        projects: Array.from(projectSet),
      };
    } else if (local) {
      merged = local;
    } else if (serverPins) {
      merged = {
        channels: Array.isArray(serverPins.channels) ? serverPins.channels : [],
        users: Array.isArray(serverPins.users) ? serverPins.users : [],
        projects: Array.isArray(serverPins.projects) ? serverPins.projects : [],
      };
    }

    set((state) => ({
      userId: currentUserId,
      workspacePins: {
        ...state.workspacePins,
        [workspaceId]: merged,
      },
    }));

    saveToStorage(workspaceId, currentUserId, merged);
  },
}));
