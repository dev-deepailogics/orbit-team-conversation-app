import { api } from '@/lib/api';
import { SERVER_URL } from '@/lib/config';
import { resolveLiveKitUrl } from '../utils';

// Same two calls the web makes (apps/web/src/app/page.tsx handleStartHuddle): a LiveKit token, then
// /start, which creates the huddle if needed and broadcasts huddle:started (that's what rings everyone else).
export async function startCallSession(channelId: string): Promise<{ token: string; serverUrl: string }> {
  const { data } = await api.post<{ token: string; serverUrl: string }>(`/api/huddles/${channelId}/token`);
  await api.post(`/api/huddles/${channelId}/start`);
  return { token: data.token, serverUrl: resolveLiveKitUrl(data.serverUrl, SERVER_URL) };
}

// Ends the huddle for everyone and deletes the LiveKit room.
export async function endCallSession(channelId: string): Promise<void> {
  await api.post(`/api/huddles/${channelId}/end`);
}
