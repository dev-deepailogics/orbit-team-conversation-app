import { prisma } from '@orbit/db';
import type { Server } from 'socket.io';
import { hasWorkspacePermission, WorkspacePermission, WorkspaceRole } from '@orbit/types';

export { hasWorkspacePermission };

/** Socket room for members allowed to see full availability records of a workspace. */
export const availabilityViewersRoom = (workspaceId: string) => `workspace:${workspaceId}:availability`;

/** Socket room holding a workspace's GUEST sockets, so public-channel broadcasts can skip them. */
export const workspaceGuestsRoom = (workspaceId: string) => `workspace:${workspaceId}:guests`;

/**
 * Broadcast a public channel's event: the whole workspace room except guests, then the guests who are in the channel.
 * Guests only ever hear channels they've been added to.
 */
export async function emitToPublicChannel(
  io: Server,
  channel: { id: string; workspaceId: string },
  event: string,
  payload: unknown,
) {
  io.to(`workspace:${channel.workspaceId}`).except(workspaceGuestsRoom(channel.workspaceId)).emit(event, payload);
  const guests = await prisma.channelMember.findMany({
    where: {
      channelId: channel.id,
      user: { memberships: { some: { workspaceId: channel.workspaceId, role: 'GUEST' } } },
    },
    select: { userId: true },
  });
  if (guests.length) io.to(guests.map((g) => `user:${g.userId}`)).emit(event, payload);
}

export interface WorkspaceAccess {
  /** null when the caller is not a member (they may still be a SUPER_ADMIN). */
  role: WorkspaceRole | null;
  systemRole: string | null;
  isMember: boolean;
  can: (permission: WorkspacePermission) => boolean;
}

/** Loads the caller's workspace role + system role in one go. */
export async function getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
  const [user, member] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } }),
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
  ]);
  const role = (member?.role as WorkspaceRole | undefined) ?? null;
  const systemRole = user?.systemRole ?? null;
  return {
    role,
    systemRole,
    isMember: !!member,
    can: (permission) => hasWorkspacePermission(role, permission, systemRole),
  };
}

/**
 * Can `viewerId` see `targetUserId`'s full availability (times, breaks, history)?
 * Yes for yourself, for SUPER_ADMIN, or when the viewer holds viewTeamAvailability
 * in a workspace the target also belongs to.
 */
export async function canViewUserAvailability(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { systemRole: true } });
  if (viewer?.systemRole === 'SUPER_ADMIN') return true;

  const viewerMemberships = await prisma.workspaceMember.findMany({
    where: { userId: viewerId },
    select: { workspaceId: true, role: true },
  });
  const workspaceIds = viewerMemberships
    .filter((m) => hasWorkspacePermission(m.role, 'viewTeamAvailability'))
    .map((m) => m.workspaceId);
  if (workspaceIds.length === 0) return false;

  const shared = await prisma.workspaceMember.findFirst({
    where: { userId: targetUserId, workspaceId: { in: workspaceIds } },
    select: { id: true },
  });
  return !!shared;
}
