import { useMemo } from "react";
import { create } from "zustand";
import type { Channel } from "@orbit/types";
import { useChatStore } from "./chatStore";

/** Enough to walk back through a working session without growing forever. */
const MAX_ENTRIES = 50;

/**
 * Back / forward through the conversations opened in this workspace, like a browser (or Slack's arrows): opening a
 * conversation after going back drops the forward entries. Holds channel ids only; channels the user can no longer see
 * (deleted, left) are skipped rather than reopened.
 */
interface NavHistoryState {
  entries: string[];
  index: number;
  /** Record that a conversation is now open (a no-op when it is the current entry, e.g. after back/forward). */
  visit: (channelId: string) => void;
  /** Move back (-1) or forward (1) to the nearest conversation that still exists; returns it, or null if none. */
  go: (direction: -1 | 1) => Channel | null;
  reset: () => void;
}

const findChannel = (id: string) => useChatStore.getState().channels.find((c) => c.id === id) ?? null;

export const useNavHistoryStore = create<NavHistoryState>((set, get) => ({
  entries: [],
  index: -1,

  visit: (channelId) => {
    const { entries, index } = get();
    if (entries[index] === channelId) return;
    const next = [...entries.slice(0, index + 1), channelId].slice(-MAX_ENTRIES);
    set({ entries: next, index: next.length - 1 });
  },

  go: (direction) => {
    const { entries, index } = get();
    for (let i = index + direction; i >= 0 && i < entries.length; i += direction) {
      const channel = findChannel(entries[i]);
      if (channel) {
        set({ index: i });
        return channel;
      }
    }
    return null;
  },

  reset: () => set({ entries: [], index: -1 }),
}));

/** Whether there is somewhere to go in each direction (ignores conversations that no longer exist). */
export const useCanNavigate = () => {
  const entries = useNavHistoryStore((s) => s.entries);
  const index = useNavHistoryStore((s) => s.index);
  const channels = useChatStore((s) => s.channels);
  return useMemo(() => {
    const ids = new Set(channels.map((c) => c.id));
    return {
      canGoBack: entries.slice(0, Math.max(index, 0)).some((id) => ids.has(id)),
      canGoForward: entries.slice(index + 1).some((id) => ids.has(id)),
    };
  }, [entries, index, channels]);
};
