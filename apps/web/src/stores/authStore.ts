import { create } from 'zustand';
import { UserProfile } from '@orbit/types';
import { api } from '../lib/api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('orbit_token') : null,
  isLoading: true,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orbit_token', token);
    }
    set({ user, token, isLoading: false });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('orbit_token');
    }
    set({ user: null, token: null, isLoading: false });
  },

  fetchMe: async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('orbit_token') : null;
      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return;
      }
      const res = await api.get('/api/auth/me');
      set({ user: res.data, token, isLoading: false });
    } catch {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('orbit_token');
      }
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
