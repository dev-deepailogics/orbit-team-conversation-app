import { create } from 'zustand';
import { getErrorMessage } from '@/lib/api';
import { getStats, getUsers, getWorkspaces } from './services/adminApi';
import type { AdminStats, AdminUser, AdminWorkspace } from './types';

interface AdminState {
  stats: AdminStats | null;
  users: AdminUser[];
  workspaces: AdminWorkspace[];
  isLoading: boolean;
  error: string;
  // Refetches everything; called on open, pull-to-refresh and after every mutation.
  load: () => Promise<void>;
}

export const useAdminStore = create<AdminState>(set => ({
  stats: null,
  users: [],
  workspaces: [],
  isLoading: false,
  error: '',

  load: async () => {
    set({ isLoading: true, error: '' });
    try {
      const [stats, users, workspaces] = await Promise.all([getStats(), getUsers(), getWorkspaces()]);
      set({ stats, users, workspaces, isLoading: false });
    } catch (err) {
      // Keep the last good data on screen; only surface the error.
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to load admin data') });
    }
  },
}));
