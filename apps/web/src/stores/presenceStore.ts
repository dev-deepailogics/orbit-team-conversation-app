import { create } from "zustand";
import type { Presence } from "../components/availability/useTeamPresence";

/**
 * Read-only mirror of the team presence the app shell already tracks (useTeamPresence), so components opened from many
 * places (e.g. the profile inside Settings) can read it without threading props or opening a second subscription.
 */
export const usePresenceStore = create<{ presence: Record<string, Presence> }>(() => ({ presence: {} }));

export const useMyPresence = (userId?: string | null): Presence =>
  usePresenceStore((s) => (userId && s.presence[userId]) || "offline");
