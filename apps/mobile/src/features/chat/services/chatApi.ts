import type { Attachment, Message, Reaction } from '@orbit/types';
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

// What /api/files/upload returns: stored on disk, but only saved to the DB once the message is sent.
export type StagedAttachment = Pick<Attachment, 'fileUrl' | 'fileName' | 'fileType' | 'fileSize' | 'fileKey' | 'storageProvider'>;

export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

export async function uploadFile(channelId: string, file: LocalFile): Promise<StagedAttachment> {
  const form = new FormData();
  // RN's FormData takes { uri, name, type } and streams the file from disk.
  form.append('file', file as unknown as Blob);
  const res = await api.post<StagedAttachment>('/api/files/upload', form, {
    params: { channelId }, // server resolves the workspace from the channel
    headers: { 'Content-Type': 'multipart/form-data' }, // else axios JSON-encodes the form
    timeout: 0, // large files outlast the default 15s
  });
  return res.data;
}

export async function sendMessage(channelId: string, content: string, attachments: StagedAttachment[] = []): Promise<Message> {
  const res = await api.post<Message>(`/api/channels/${channelId}/messages`, { content, attachments });
  return res.data;
}

export async function getThread(messageId: string): Promise<{ parent: Message; replies: Message[] }> {
  const res = await api.get<{ parent: Message; replies: Message[] }>(`/api/messages/${messageId}/replies`);
  return res.data;
}

export async function sendReply(messageId: string, content: string, attachments: StagedAttachment[] = []): Promise<Message> {
  const res = await api.post<Message>(`/api/messages/${messageId}/replies`, { content, attachments });
  return res.data;
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  const res = await api.patch<Message>(`/api/messages/${messageId}`, { content });
  return res.data;
}

// Soft delete: the server keeps the row (isDeleted, content cleared) so threads and replies stay intact.
export async function deleteMessage(messageId: string): Promise<Message> {
  const res = await api.delete<{ message: Message }>(`/api/messages/${messageId}`);
  return res.data.message;
}

// Toggles: adds the reaction, or removes it if the caller already reacted with that emoji.
export async function toggleReaction(messageId: string, emoji: string): Promise<Reaction[]> {
  const res = await api.post<{ reactions: Reaction[] }>(`/api/messages/${messageId}/reactions`, { emoji });
  return res.data.reactions;
}
