import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export const TOKEN_KEY = 'orbit_token';
export const REFRESH_TOKEN_KEY = 'orbit_refresh_token';
export const TOKEN_REFRESHED_EVENT = 'orbit:token-refreshed';

export const api = axios.create({
  baseURL: SERVER_URL,
  // Lets the browser keep the HttpOnly file-session cookie the API sets at sign-in (needed when the API is on another
  // port in development). Files and images are only served to signed-in users with access.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// One refresh at a time: concurrent 401s (and the socket) all wait on the same request.
let refreshing: Promise<string> | null = null;

/** Swaps the stored refresh token for a new access token. Rejects (without logging out) if that fails. */
export function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;
  const usedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const usedAccessToken = localStorage.getItem(TOKEN_KEY);
  if (!usedRefreshToken) return Promise.reject(new Error('No refresh token'));

  refreshing = axios
    .post(`${SERVER_URL}/api/auth/refresh`, { refreshToken: usedRefreshToken })
    .then((res) => {
      localStorage.setItem(TOKEN_KEY, res.data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refreshToken);
      window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: res.data.accessToken }));
      return res.data.accessToken as string;
    })
    .catch((err) => {
      // Another tab may have rotated the token first (storage is shared): use what it saved.
      const current = localStorage.getItem(TOKEN_KEY);
      if (current && current !== usedAccessToken) return current;
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const isAuthEndpoint = (url?: string) =>
  !!url && /\/api\/auth\/(login|register|refresh|logout)$/.test(url.split('?')[0]);

// Response interceptor: transparently refresh an expired access token, otherwise force logout.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (typeof window === 'undefined') return Promise.reject(error);

    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isDeactivated =
      error.response?.status === 403 &&
      (error.response?.data as { error?: string } | undefined)?.error === 'Account is deactivated';
    const isUnauthorized = error.response?.status === 401;

    // Expired access token: refresh once, then replay the request.
    if (
      isUnauthorized &&
      original &&
      !original._retried &&
      !isAuthEndpoint(original.url) &&
      localStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        // Network blips must not log the user out; only a rejected refresh token ends the session.
        const status = (refreshError as AxiosError).response?.status;
        if (status !== 401 && status !== 403) return Promise.reject(error);
      }
    }

    // Only redirect if not already on /login or /register
    const isAuthPage =
      window.location.pathname.startsWith('/login') ||
      window.location.pathname.startsWith('/register');

    if ((isDeactivated || isUnauthorized) && !isAuthPage && !isAuthEndpoint(original?.url)) {
      clearSession();
      if (isDeactivated) {
        alert('Your account has been deactivated. Please contact your administrator.');
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
