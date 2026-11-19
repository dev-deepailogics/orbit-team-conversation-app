import { prisma, Prisma } from '@orbit/db';
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
 * Canvas access: canvases linked to a channel inherit that channel's access;
 * unlinked or project-linked canvases are visible to the whole workspace.
 */
export async function canUserAccessCanvas(
  userId: string,
  canvas: { workspaceId: string; channelId: string | null }
): Promise<boolean> {
  return canvas.channelId
    ? canUserAccessChannel(userId, canvas.channelId)
    : canUserAccessWorkspace(userId, canvas.workspaceId);
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

/**
 * How a quoted or forwarded message is returned alongside the message that references it. One shape everywhere, since
 * the client replaces whole messages on edit/pin/delete and a narrower include would strip the forwarded card.
 */
export const quotedMessageInclude = {
  include: {
    user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    channel: { select: { id: true, name: true, type: true } },
    attachments: { where: { isDeleted: false } },
  },
} satisfies Prisma.MessageDefaultArgs;

/**
 * HTTP Guard: a message may quote (or forward) another only if the caller can read it. Quoting across channels is a
 * forward, which is refused out of anonymous channels (it would expose the author) and for deleted messages. Returns
 * the quoted message, or null once the reply has been sent.
 */
export async function verifyQuotable(
  userId: string,
  quotedMessageId: string,
  targetChannelId: string,
  reply: FastifyReply
): Promise<{ id: string; channelId: string; content: string } | null> {
  const access = await verifyMessageAccess(userId, quotedMessageId, reply);
  if (!access) return null;
  if (access.message.isDeleted) {
    reply.status(400).send({ error: 'That message has been deleted' });
    return null;
  }
  if (access.message.channelId !== targetChannelId && access.channel.isAnonymous) {
    reply.status(400).send({ error: 'Messages from anonymous channels cannot be forwarded' });
    return null;
  }
  return access.message;
}
