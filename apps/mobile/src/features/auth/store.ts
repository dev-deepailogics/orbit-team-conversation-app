import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import type { UserProfile } from '@orbit/types';
import { api, setAuthToken } from '@/lib/api';
import { unregisterPushToken } from '@/features/notifications/services/pushToken';
import { getMe } from './services/authApi';

// Token lives in iOS Keychain / Android Keystore, never in plain AsyncStorage.
const KEYCHAIN_SERVICE = 'orbit_token';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  // Set when the saved session couldn't be checked (offline/server down), so we don't log the user out.
  bootError: string | null;
  setAuth: (user: UserProfile, token: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  bootError: null,

  setAuth: async (user, token) => {
    await Keychain.setGenericPassword('orbit', token, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    setAuthToken(token);
    set({ user, token, isLoading: false, bootError: null });
  },

  logout: async () => {
    // Fire before the bearer token is cleared so this device stops getting the old user's pushes.
    unregisterPushToken();
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    setAuthToken(null);
    set({ user: null, token: null, isLoading: false, bootError: null });
  },

  fetchMe: async () => {
    set({ isLoading: true, bootError: null });
    // A keychain failure must not leave the app stuck on the splash spinner; treat it as signed out.
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE }).catch((err) => {
      console.warn('Keychain read failed', err);
      return false as const;
    });
    if (!creds) {
      set({ user: null, token: null, isLoading: false });
      return;
    }
    setAuthToken(creds.password);
    try {
      const user = await getMe();
      set({ user, token: creds.password, isLoading: false });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 404) {
        await get().logout();
      } else {
        set({ isLoading: false, bootError: 'Cannot reach the server. Check your connection.' });
      }
    }
  },
}));

// Any 401 means the token is dead (e.g. JWT_SECRET rotated): drop the session.
api.interceptors.response.use(undefined, async (err) => {
  if (axios.isAxiosError(err) && err.response?.status === 401 && useAuthStore.getState().token) {
    await useAuthStore.getState().logout();
  }
  return Promise.reject(err);
});
