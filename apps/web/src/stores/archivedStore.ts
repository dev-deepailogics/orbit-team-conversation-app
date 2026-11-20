import { create } from "zustand";
import { saveMemberSettings } from "../lib/memberSettings";

/**
 * Conversations the user archived, per workspace. Personal (like pins): it only tidies this user's sidebar and never
 * affects anyone else. Channels and group DMs are keyed by channel id, 1:1 DMs by the other person's user id (the
 * sidebar lists people, some with no DM channel yet). Unrelated to Channel.isArchived, which is workspace-wide.
 */
export interface ArchivedConversations {
  channels: string[];
  users: string[];
}
export type ArchiveKind = keyof ArchivedConversations;

export const NO_ARCHIVED: ArchivedConversations = { channels: [], users: [] };

const storageKey = (workspaceId: string, userId: string) => `orbit_archived_${workspaceId}_${userId}`;

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const parse = (v: any): ArchivedConversations | null =>
  v && typeof v === "object" ? { channels: ids(v.channels), users: ids(v.users) } : null;

interface ArchivedState {
  byWorkspace: Record<string, ArchivedConversations>;
  userId: string | null;
  /** Server settings win (they follow the user across devices); localStorage only covers the first paint. */
  init: (workspaceId: string, userId: string, serverSettings?: { archived?: unknown } | null) => void;
  archive: (workspaceId: string, kind: ArchiveKind, id: string) => void;
  /** Bring conversations back to the main lists (no-op, and no request, when none of them is archived). */
  unarchive: (workspaceId: string, items: Partial<ArchivedConversations>) => void;
}

export const useArchivedStore = create<ArchivedState>((set, get) => {
  const commit = (workspaceId: string, next: ArchivedConversations) => {
    set((s) => ({ byWorkspace: { ...s.byWorkspace, [workspaceId]: next } }));
    const uid = get().userId;
    if (uid) {
      try {
        localStorage.setItem(storageKey(workspaceId, uid), JSON.stringify(next));
      } catch {
        // Ignore quota / private-mode errors
      }
    }
    saveMemberSettings(workspaceId, { archived: next });
  };

  return {
    byWorkspace: {},
    userId: null,

    init: (workspaceId, userId, serverSettings) => {
      if (!workspaceId || !userId) return;
      let value = parse(serverSettings?.archived);
      try {
        if (!value) value = parse(JSON.parse(localStorage.getItem(storageKey(workspaceId, userId)) || "null"));
        if (value) localStorage.setItem(storageKey(workspaceId, userId), JSON.stringify(value));
      } catch {
        // Storage unavailable or corrupt: fall back to the server value or nothing
      }
      set((s) => ({ userId, byWorkspace: { ...s.byWorkspace, [workspaceId]: value ?? NO_ARCHIVED } }));
    },

    archive: (workspaceId, kind, id) => {
      const current = get().byWorkspace[workspaceId] ?? NO_ARCHIVED;
      if (!workspaceId || !id || current[kind].includes(id)) return;
      commit(workspaceId, { ...current, [kind]: [...current[kind], id] });
    },

    unarchive: (workspaceId, items) => {
      const current = get().byWorkspace[workspaceId] ?? NO_ARCHIVED;
      const drop = (kind: ArchiveKind) => {
        const remove = new Set(items[kind] ?? []);
        return remove.size ? current[kind].filter((id) => !remove.has(id)) : current[kind];
      };
      const next = { channels: drop("channels"), users: drop("users") };
      if (next.channels.length === current.channels.length && next.users.length === current.users.length) return;
      commit(workspaceId, next);
    },
  };
});

export const useArchived = (workspaceId?: string | null): ArchivedConversations =>
  useArchivedStore((s) => (workspaceId && s.byWorkspace[workspaceId]) || NO_ARCHIVED);
