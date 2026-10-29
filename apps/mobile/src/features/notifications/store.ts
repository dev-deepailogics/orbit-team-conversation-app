import { create } from 'zustand';
import type { InAppBanner } from './types';

interface NotificationState {
  banner: InAppBanner | null;
  show: (b: InAppBanner) => void;
  dismiss: () => void;
}

export const useNotificationStore = create<NotificationState>(set => ({
  banner: null,
  show: banner => set({ banner }),
  dismiss: () => set({ banner: null }),
}));
