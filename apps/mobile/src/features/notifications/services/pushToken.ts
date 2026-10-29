import { api } from '@/lib/api';
import { Platform } from 'react-native';

let registered: string | null = null;

export async function registerPushToken(token: string) {
  if (token === registered) return;
  await api.post('/api/push/device', { token, platform: Platform.OS });
  registered = token;
}

// Call before the auth token is cleared; best effort (the server also prunes dead tokens on send).
export function unregisterPushToken() {
  const token = registered;
  registered = null;
  if (!token) return Promise.resolve();
  return api.post('/api/push/device/remove', { token }).then(
    () => undefined,
    () => undefined,
  );
}
