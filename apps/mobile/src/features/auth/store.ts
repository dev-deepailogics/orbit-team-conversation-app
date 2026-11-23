import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import type { UserProfile } from '@orbit/types';
import { api, getAuthToken, setAuthToken, setTokenRefresher } from '@/lib/api';
import { SERVER_URL } from '@/lib/config';
import { unregisterPushToken } from '@/features/notifications/services/pushToken';
import { getMe } from './services/authApi';

// Tokens live in iOS Keychain / Android Keystore, never in plain AsyncStorage.
// One entry: JSON `{"a": accessToken, "r": refreshToken}`. Sessions saved before refresh tokens existed hold the
// bare access token string, which is still read as-is.
const KEYCHAIN_SERVICE = 'orbit_token';

type Creds = { access: string; refresh: string | null };

function parseCreds(raw: string): Creds {
  if (raw.startsWith('{')) {
    try {
      const { a, r } = JSON.parse(raw);
      if (typeof a === 'string') return { access: a, refresh: typeof r === 'string' ? r : null };
    } catch {
      // not JSON after all: fall through to the legacy format
    }
  }
  return { access: raw, refresh: null };
}

async function saveCreds({ access, refresh }: Creds) {
  await Keychain.setGenericPassword('orbit', refresh ? JSON.stringify({ a: access, r: refresh }) : access, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

// In memory so request handlers never wait on the keychain.
let refreshToken: string | null = null;
let refreshing: Promise<string> | null = null;

const isAuthEndpoint = (url?: string) => !!url && /\/api\/auth\/(login|register|refresh|logout)$/.test(url.split('?')[0]);

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  // Set when the saved session couldn't be checked (offline/server down), so we don't log the user out.
  bootError: string | null;
  setAuth: (user: UserProfile, token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  bootError: null,

  setAuth: async (user, token, newRefreshToken) => {
    // Omitted when only the access token changed (e.g. a profile update re-signs the JWT).
    if (newRefreshToken !== undefined) refreshToken = newRefreshToken;
    await saveCreds({ access: token, refresh: refreshToken });
    setAuthToken(token);
    set({ user, token, isLoading: false, bootError: null });
  },

  logout: async () => {
    // Fire before the bearer token is cleared so this device stops getting the old user's pushes.
    unregisterPushToken();
    // Revoke the session server-side (best effort; never blocks sign-out).
    if (refreshToken) axios.post(`${SERVER_URL}/api/auth/logout`, { refreshToken }, { timeout: 5000 }).catch(() => {});
    refreshToken = null;
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
    const saved = parseCreds(creds.password);
    refreshToken = saved.refresh;
    setAuthToken(saved.access);
    try {
      const user = await getMe();
      // getMe may have refreshed the access token along the way.
      set({ user, token: getAuthToken() ?? saved.access, isLoading: false });
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

// Exchanges the refresh token for new credentials (single-flight). Rejects with the axios error on failure.
function refreshSession(): Promise<string> {
  if (refreshing) return refreshing;
  const used = refreshToken;
  if (!used) return Promise.reject(new Error('No refresh token'));

  refreshing = axios
    .post(`${SERVER_URL}/api/auth/refresh`, { refreshToken: used }, { timeout: 15000 })
    .then(async (res) => {
      const { accessToken, refreshToken: rotated } = res.data as { accessToken: string; refreshToken: string };
      refreshToken = rotated;
      await saveCreds({ access: accessToken, refresh: rotated });
      setAuthToken(accessToken);
      useAuthStore.setState({ token: accessToken });
      return accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

setTokenRefresher(() => refreshSession().catch(() => null));

// A 401 means the access token expired (or is dead): renew it once and replay the request. Only when the
// refresh token is rejected too (or absent) is the session dropped; being offline never signs the user out.
api.interceptors.response.use(undefined, async (err) => {
  if (!axios.isAxiosError(err) || err.response?.status !== 401 || !getAuthToken()) {
    // (no token on the request, e.g. a wrong-password login: nothing to refresh or sign out)
    return Promise.reject(err);
  }

  const config = err.config as (typeof err.config & { _retried?: boolean }) | undefined;
  if (config && !config._retried && refreshToken && !isAuthEndpoint(config.url)) {
    config._retried = true;
    try {
      const token = await refreshSession();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    } catch (refreshErr) {
      // Only a rejected refresh token (401/403) ends the session. Offline, timeouts, 5xx (e.g. a 502 while prod
      // restarts) and keychain errors report that error instead of the stale 401, so callers keep the session.
      const status = axios.isAxiosError(refreshErr) ? refreshErr.response?.status : undefined;
      if (status !== 401 && status !== 403) return Promise.reject(refreshErr);
    }
  }

  await useAuthStore.getState().logout();
  return Promise.reject(err);
});
