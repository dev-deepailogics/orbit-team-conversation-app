import type { Channel, Workspace, WorkspaceMember, WorkspaceRole } from '@orbit/types';
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

// Server allows SUPER_ADMIN or workspace OWNER/ADMIN; the mobile UI only exposes it to super admins.
export async function addWorkspaceMember(
  workspaceId: string,
  emailOrUsername: string,
  role: Extract<WorkspaceRole, 'MEMBER' | 'ADMIN'>,
): Promise<WorkspaceMember> {
  const res = await api.post<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, { emailOrUsername, role });
  return res.data;
}

export async function createChannel(
  workspaceId: string,
  name: string,
  type: 'PUBLIC' | 'PRIVATE',
): Promise<Channel> {
  const res = await api.post<Channel>(`/api/channels/workspaces/${workspaceId}/channels`, { name, type });
  return res.data;
}

// Users must already be workspace members; returns the updated channel.
export async function addChannelMembers(channelId: string, userIds: string[]): Promise<Channel> {
  const res = await api.post<Channel>(`/api/channels/${channelId}/members`, { userIds });
  return res.data;
}
