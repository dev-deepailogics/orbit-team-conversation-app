import { prisma } from '@orbit/db';
import { FastifyReply } from 'fastify';

/**
 * Checks if a user has access to a workspace (Super Admin or Workspace Member).
 */
export async function canUserAccessWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  if (!userId || !workspaceId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'SUPER_ADMIN') return true;

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return !!member;
}

/**
 * Checks if a user has access to a channel (Super Admin, or workspace member for public, or channel member for private/DM).
 */
export async function canUserAccessChannel(userId: string, channelId: string): Promise<boolean> {
  if (!userId || !channelId) return false;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: { select: { userId: true } },
    },
  });

  if (!channel) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'SUPER_ADMIN') return true;

  // Must belong to the channel's workspace
  const isWsMember = await canUserAccessWorkspace(userId, channel.workspaceId);
  if (!isWsMember) return false;

  // If private or direct channel, must be in channel.members
  if (channel.type !== 'PUBLIC') {
    return channel.members.some((m) => m.userId === userId);
  }

  return true;
}

/**
 * HTTP Guard: Verifies workspace membership.
 * Sends 403 response if unauthorized.
 */
export async function verifyWorkspaceMember(
  userId: string,
  workspaceId: string,
  reply: FastifyReply
): Promise<{ isSuperAdmin: boolean; workspaceMember: any } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'SUPER_ADMIN') {
    return { isSuperAdmin: true, workspaceMember: null };
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!member) {
    reply.status(403).send({ error: 'You are not a member of this workspace' });
    return null;
  }

  return { isSuperAdmin: false, workspaceMember: member };
}

/**
 * HTTP Guard: Verifies channel access.
 * Sends 404 or 403 response if unauthorized.
 */
export async function verifyChannelAccess(
  userId: string,
  channelId: string,
  reply: FastifyReply
): Promise<{ channel: any; isSuperAdmin: boolean } | null> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (!channel) {
    reply.status(404).send({ error: 'Channel not found' });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === 'SUPER_ADMIN') {
    return { channel, isSuperAdmin: true };
  }

  // Caller MUST belong to the workspace containing this channel
  const wsMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: channel.workspaceId,
        userId,
      },
    },
  });

  if (!wsMember) {
    reply.status(403).send({ error: 'You do not belong to the workspace of this channel' });
    return null;
  }

  // If private or direct channel, caller must be a member
  if (channel.type !== 'PUBLIC') {
    const isChannelMember = channel.members.some((m) => m.userId === userId);
    if (!isChannelMember) {
      reply.status(403).send({ error: 'You are not a member of this private channel' });
      return null;
    }
  }

  return { channel, isSuperAdmin: false };
}

/**
 * HTTP Guard: Verifies message access via its channel.
 */
export async function verifyMessageAccess(
  userId: string,
  messageId: string,
  reply: FastifyReply
): Promise<{ message: any; channel: any; isSuperAdmin: boolean } | null> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    reply.status(404).send({ error: 'Message not found' });
    return null;
  }

  const access = await verifyChannelAccess(userId, message.channelId, reply);
  if (!access) return null;

  return { message, channel: access.channel, isSuperAdmin: access.isSuperAdmin };
}
