import axios from 'axios';
import { SERVER_URL } from './config';

export const api = axios.create({
  baseURL: SERVER_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Kept here (not read from the store) so api.ts and authStore.ts don't import each other.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Server sends `{ error: string }` on 4xx (see apps/server/src/routes/auth.ts).
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check your connection.';
    return err.response.data?.error || fallback;
  }
  return fallback;
}
