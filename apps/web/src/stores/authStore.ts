import { create } from 'zustand';
import { UserProfile } from '@orbit/types';
import { api, clearSession, REFRESH_TOKEN_KEY, TOKEN_KEY, TOKEN_REFRESHED_EVENT } from '../lib/api';
import { useChatStore } from './chatStore';
import { clearAllDrafts } from '../lib/drafts';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  // refreshToken is omitted when only the access token changed (e.g. a profile update re-signs the JWT).
  setAuth: (user: UserProfile, token: string, refreshToken?: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  isLoading: true,

  setAuth: (user, token, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    set({ user, token, isLoading: false });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      // Revoke the session server-side (best effort), then forget it locally.
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) api.post('/api/auth/logout', { refreshToken }).catch(() => {});
      clearSession();
      clearAllDrafts(); // unsent drafts are device-local and must not outlive the session on a shared computer
    }
    useChatStore.getState().reset();
    set({ user: null, token: null, isLoading: false });
  },

  fetchMe: async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return;
      }
      const res = await api.get('/api/auth/me');
      // The request may have refreshed the access token along the way.
      set({ user: res.data, token: localStorage.getItem(TOKEN_KEY) ?? token, isLoading: false });
    } catch {
      if (typeof window !== 'undefined') {
        clearSession();
      }
      set({ user: null, token: null, isLoading: false });
    }
  },
}));

// Invite code saved by /join when the visitor must sign in first. Stored (not a ?redirect param)
// so it survives the Microsoft OAuth round-trip and hopping from /login to /register.
export const PENDING_INVITE_KEY = 'orbit_pending_invite';

/** Where to land after sign-in/sign-up: back to a pending /join invite, else the app. */
export function postAuthPath() {
  const code = typeof window !== 'undefined' ? localStorage.getItem(PENDING_INVITE_KEY) : null;
  return code ? `/join/${code}` : '/app';
}

// Keep the store's token in step with silent refreshes done by the api client / socket.
if (typeof window !== 'undefined') {
  window.addEventListener(TOKEN_REFRESHED_EVENT, (e) => {
    useAuthStore.setState({ token: (e as CustomEvent<string>).detail });
  });
}
