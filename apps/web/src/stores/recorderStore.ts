import { create } from 'zustand';

interface RecorderState {
  isOpen: boolean;
  workspaceId: string | null;
  /** Conversation the recorder was opened from; listed first under "Share in Orbit". */
  channelId: string | null;
  open: (params: { workspaceId: string; channelId?: string }) => void;
  close: () => void;
}

// Lives outside any single view's component tree (rendered once at the app root)
// so an in-progress recording survives switching between Chat / Video Library /
// Canvas / Docs instead of being torn down when that view unmounts.
export const useRecorderStore = create<RecorderState>((set) => ({
  isOpen: false,
  workspaceId: null,
  channelId: null,
  open: ({ workspaceId, channelId }) => set({ isOpen: true, workspaceId, channelId: channelId || null }),
  close: () => set({ isOpen: false, workspaceId: null, channelId: null }),
}));
