import { create } from "zustand";
import { api } from "../lib/api";

/** How the sidebar orders channels, group DMs and DMs. Unread conversations always rise above either order. */
export type SidebarSort = "recent" | "alphabetical";

export const DEFAULT_SIDEBAR_SORT: SidebarSort = "recent";

const isSort = (v: unknown): v is SidebarSort => v === "recent" || v === "alphabetical";
const storageKey = (workspaceId: string, userId: string) => `orbit_sidebar_sort_${workspaceId}_${userId}`;

interface SidebarSortState {
  // Keyed by workspaceId, like pins (stored in the member's per-workspace settings)
  sorts: Record<string, SidebarSort>;
  userId: string | null;
  /** Server settings win (they follow the user across devices); localStorage only covers the first paint. */
  init: (workspaceId: string, userId: string, serverSettings?: { sidebarSort?: unknown } | null) => void;
  setSort: (workspaceId: string, sort: SidebarSort) => void;
}

export const useSidebarSortStore = create<SidebarSortState>((set, get) => ({
  sorts: {},
  userId: null,

  init: (workspaceId, userId, serverSettings) => {
    if (!workspaceId || !userId) return;
    let sort: SidebarSort | null = isSort(serverSettings?.sidebarSort) ? serverSettings.sidebarSort : null;
    try {
      const local = localStorage.getItem(storageKey(workspaceId, userId));
      if (!sort && isSort(local)) sort = local;
      if (sort) localStorage.setItem(storageKey(workspaceId, userId), sort);
    } catch {
      // Storage unavailable (private mode): the server value or the default still applies
    }
    set((s) => ({ userId, sorts: { ...s.sorts, [workspaceId]: sort ?? DEFAULT_SIDEBAR_SORT } }));
  },

  setSort: (workspaceId, sort) => {
    if (!workspaceId || get().sorts[workspaceId] === sort) return;
    set((s) => ({ sorts: { ...s.sorts, [workspaceId]: sort } }));
    const uid = get().userId;
    if (uid) {
      try {
        localStorage.setItem(storageKey(workspaceId, uid), sort);
      } catch {
        // Ignore quota / private-mode errors
      }
    }
    api
      .patch(`/api/workspaces/${workspaceId}/member-settings`, { sidebarSort: sort })
      .catch((err) => console.debug("Failed to sync sidebar sort", err));
  },
}));

export const useSidebarSort = (workspaceId?: string | null): SidebarSort =>
  useSidebarSortStore((s) => (workspaceId && s.sorts[workspaceId]) || DEFAULT_SIDEBAR_SORT);
