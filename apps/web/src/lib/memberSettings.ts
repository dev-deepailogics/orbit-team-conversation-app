import { api } from "./api";

// The server merges each patch into the member's settings (read, merge, write). Sending patches one at a time keeps a
// quick pin + archive, or two fast toggles, from landing out of order and overwriting each other.
let queue: Promise<unknown> = Promise.resolve();

/** Save part of the signed-in member's per-workspace settings. Never throws: the local copy is already updated. */
export function saveMemberSettings(workspaceId: string, patch: Record<string, unknown>): Promise<unknown> {
  queue = queue
    .then(() => api.patch(`/api/workspaces/${workspaceId}/member-settings`, patch))
    .catch((err) => console.debug("Failed to save member settings", err));
  return queue;
}
