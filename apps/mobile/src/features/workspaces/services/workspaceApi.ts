import type { Channel, Workspace } from '@orbit/types';
import { api } from '@/lib/api';
import type { WorkspaceDetail } from '../types';

export async function getWorkspaces(): Promise<Workspace[]> {
  const res = await api.get<Workspace[]>('/api/workspaces');
  return res.data;
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
  const res = await api.get<WorkspaceDetail>(`/api/workspaces/${workspaceId}`);
  return res.data;
}

export async function joinWorkspace(inviteCode: string): Promise<string> {
  const res = await api.post<{ workspaceId: string }>('/api/workspaces/join', { inviteCode });
  return res.data.workspaceId;
}

// Returns the existing DM if there is one (server dedupes), including a self-DM.
export async function openDirectMessage(workspaceId: string, targetUserId: string): Promise<Channel> {
  const res = await api.post<Channel>(`/api/channels/workspaces/${workspaceId}/dm`, { targetUserId });
  return res.data;
}
