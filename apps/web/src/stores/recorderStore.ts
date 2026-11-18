import { create } from 'zustand';

interface RecorderState {
  isOpen: boolean;
  workspaceId: string | null;
  channelId: string | null;
  onInsertLink: ((link: string) => void) | null;
  open: (params: { workspaceId: string; channelId?: string; onInsertLink?: (link: string) => void }) => void;
  close: () => void;
}

// Lives outside any single view's component tree (rendered once at the app root)
// so an in-progress recording survives switching between Chat / Video Library /
// Canvas / Docs instead of being torn down when that view unmounts.
export const useRecorderStore = create<RecorderState>((set) => ({
  isOpen: false,
  workspaceId: null,
  channelId: null,
  onInsertLink: null,
  open: ({ workspaceId, channelId, onInsertLink }) =>
    set({ isOpen: true, workspaceId, channelId: channelId || null, onInsertLink: onInsertLink || null }),
  close: () => set({ isOpen: false, workspaceId: null, channelId: null, onInsertLink: null }),
}));
