import type { UserAvailabilityRecord } from '@orbit/types';
import { create } from 'zustand';
import { getErrorMessage } from '@/lib/api';
import type { AvailabilityResponse } from './services/availabilityApi';
import { getCurrent } from './services/availabilityApi';

interface AvailabilityState {
  record: UserAvailabilityRecord | null;
  // serverTime - Date.now(), so the worked-time clock follows the server, not a skewed phone clock.
  offsetMs: number;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  // Runs one of the availabilityApi actions; false if it failed or another one was still running (double tap).
  run: (call: () => Promise<AvailabilityResponse>, fallback: string) => Promise<boolean>;
  // Realtime update (e.g. changed on web, or the server's auto-checkout).
  setRecord: (record: UserAvailabilityRecord | null) => void;
  reset: () => void;
}

const initial = { record: null, offsetMs: 0, busy: false, error: null };

const apply = (res: AvailabilityResponse) => ({
  record: res.availability,
  offsetMs: new Date(res.serverTime).getTime() - Date.now() || 0,
});

export const useAvailabilityStore = create<AvailabilityState>((set, get) => ({
  ...initial,

  load: async () => {
    try {
      set({ ...apply(await getCurrent()), error: null });
    } catch (err) {
      set({ error: getErrorMessage(err, 'Could not load your status') });
    }
  },

  run: async (call, fallback) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      set({ ...apply(await call()), busy: false });
      return true;
    } catch (err) {
      set({ busy: false, error: getErrorMessage(err, fallback) });
      return false;
    }
  },

  setRecord: record => set({ record }),
  reset: () => set(initial),
}));
