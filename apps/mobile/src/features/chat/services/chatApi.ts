import type { Message, Reaction } from '@orbit/types';
import { api } from '@/lib/api';

export interface MessagePage {
  messages: Message[]; // oldest → newest
  hasMore: boolean;
  nextCursor: string | null;
}

export const PAGE_SIZE = 30;

export async function getMessages(channelId: string, cursor?: string | null): Promise<MessagePage> {
  const res = await api.get<MessagePage>(`/api/channels/${channelId}/messages`, {
    params: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
  });
  return res.data;
}

export async function sendMessage(channelId: string, content: string): Promise<Message> {
  const res = await api.post<Message>(`/api/channels/${channelId}/messages`, { content });
  return res.data;
}

export async function getThread(messageId: string): Promise<{ parent: Message; replies: Message[] }> {
  const res = await api.get<{ parent: Message; replies: Message[] }>(`/api/messages/${messageId}/replies`);
  return res.data;
}

export async function sendReply(messageId: string, content: string): Promise<Message> {
  const res = await api.post<Message>(`/api/messages/${messageId}/replies`, { content });
  return res.data;
}

// Toggles: adds the reaction, or removes it if the caller already reacted with that emoji.
export async function toggleReaction(messageId: string, emoji: string): Promise<Reaction[]> {
  const res = await api.post<{ reactions: Reaction[] }>(`/api/messages/${messageId}/reactions`, { emoji });
  return res.data.reactions;
}
