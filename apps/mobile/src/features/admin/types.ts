import type { SystemRole, UserStatus, WorkspaceRole } from '@orbit/types';

// Response shapes of apps/server/src/routes/admin.ts.
export interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalChannels: number;
  totalMessages: number;
  totalAttachments: number;
  totalStorageBytes: number;
  formattedStorage: string;
  onlineUsers: number;
  roles: Partial<Record<SystemRole, number>>;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  systemRole: SystemRole;
  status: UserStatus;
  createdAt: string;
  memberships: Array<{
    role: WorkspaceRole;
    workspace: { id: string; name: string; slug: string };
  }>;
  _count: { memberships: number; ownedWorkspaces: number; messages: number };
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner?: { id: string; email: string; username: string; displayName: string };
  _count: { members: number; channels: number; attachments: number };
}

// `ownerEmailOrId` set = super admin creating on someone's behalf; unset = caller owns it.
export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  ownerEmailOrId?: string;
}

export type RoleFilter = SystemRole | 'ALL';
