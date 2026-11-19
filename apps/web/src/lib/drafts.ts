// Unsent message drafts, kept in this browser's localStorage only (never sent to the server), so a half-written
// message survives navigating away and back, switching channels or reloading the page.
// Keyed by user and scope (a channel id, or `thread:<messageId>`), so users sharing a browser never see each other's drafts.

const PREFIX = 'orbit_draft_v1:';
const MAX_LENGTH = 50_000; // keeps one runaway draft from filling the storage quota

const keyFor = (userId: string, scope: string) => `${PREFIX}${userId}:${scope}`;

/** The saved draft (markdown), or undefined when there is none or storage is unavailable. */
export function loadDraft(userId: string, scope: string): string | undefined {
  try {
    return localStorage.getItem(keyFor(userId, scope)) || undefined;
  } catch {
    return undefined; // storage blocked (private mode, disabled cookies): drafts just don't persist
  }
}

/** Saves the draft; an empty or whitespace-only draft removes it. */
export function saveDraft(userId: string, scope: string, markdown: string) {
  try {
    if (!markdown.trim()) localStorage.removeItem(keyFor(userId, scope));
    else localStorage.setItem(keyFor(userId, scope), markdown.slice(0, MAX_LENGTH));
  } catch {
    // quota exceeded or storage blocked: not worth interrupting typing
  }
}

export function clearDraft(userId: string, scope: string) {
  try {
    localStorage.removeItem(keyFor(userId, scope));
  } catch {
    // ignore
  }
}

/** Removes every draft on this device, used on sign-out so a shared computer keeps nothing behind. */
export function clearAllDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
