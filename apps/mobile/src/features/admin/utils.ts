import type { SystemRole } from '@orbit/types';
import type { AdminUser, AdminWorkspace, RoleFilter } from './types';

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  WORKSPACE_ADMIN: 'Workspace Admin',
  USER: 'User',
};

export const ROLES = Object.keys(ROLE_LABELS) as SystemRole[];

// Server requires /^[a-z0-9-]+$/ (apps/server/src/routes/workspaces.ts).
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,50}$/.test(slug);
}

const matches = (query: string, ...fields: Array<string | undefined>) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some(f => f?.toLowerCase().includes(q));
};

export function filterUsers(users: AdminUser[], query: string, role: RoleFilter): AdminUser[] {
  return users.filter(
    u => (role === 'ALL' || u.systemRole === role) && matches(query, u.displayName, u.username, u.email),
  );
}

export function filterWorkspaces(workspaces: AdminWorkspace[], query: string): AdminWorkspace[] {
  return workspaces.filter(w => matches(query, w.name, w.slug, w.owner?.displayName, w.owner?.email));
}
