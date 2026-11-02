import type { SystemRole, Workspace } from '@orbit/types';
import { api } from '@/lib/api';
import type { AdminStats, AdminUser, AdminWorkspace, CreateWorkspaceInput } from '../types';

// All /api/admin routes are SUPER_ADMIN-only (server returns 403 otherwise).
export async function getStats(): Promise<AdminStats> {
  const res = await api.get<AdminStats>('/api/admin/stats');
  return res.data;
}

export async function getUsers(): Promise<AdminUser[]> {
  const res = await api.get<AdminUser[]>('/api/admin/users');
  return res.data;
}

export async function getWorkspaces(): Promise<AdminWorkspace[]> {
  const res = await api.get<AdminWorkspace[]>('/api/admin/workspaces');
  return res.data;
}

export async function updateUserRole(userId: string, systemRole: SystemRole): Promise<void> {
  await api.patch(`/api/admin/users/${userId}/role`, { systemRole });
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await api.post(`/api/admin/users/${userId}/reset-password`, { newPassword });
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/api/admin/users/${userId}`);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await api.delete(`/api/admin/workspaces/${workspaceId}`);
}

// Workspace admins create their own workspace; super admins can assign any owner via the admin route.
export async function createWorkspace({ ownerEmailOrId, ...input }: CreateWorkspaceInput): Promise<Workspace> {
  const res = ownerEmailOrId
    ? await api.post<Workspace>('/api/admin/workspaces', { ...input, ownerEmailOrId })
    : await api.post<Workspace>('/api/workspaces', input);
  return res.data;
}
