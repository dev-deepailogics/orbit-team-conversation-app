import { Server as SocketIOServer, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';
import { canUserAccessWorkspace, canUserAccessChannel } from '../utils/security.js';

export function setupSocketServer(fastify: FastifyInstance, io: SocketIOServer) {
  // Store connected user socket mapping
  const userSocketMap = new Map<string, Set<string>>();

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string);

    if (token) {
      try {
        const decoded = fastify.jwt.verify(token) as { id: string; email: string; username: string };
        socket.data.userId = decoded.id;
        socket.data.user = decoded;
        return next();
      } catch (err) {
        // Fallback check if valid user id was sent directly (e.g. testing)
        const fallbackUserId = socket.handshake.auth?.userId as string;
        if (fallbackUserId) {
          const user = await prisma.user.findUnique({ where: { id: fallbackUserId } });
          if (user) {
            socket.data.userId = user.id;
            socket.data.user = user;
            return next();
          }
        }
        return next(new Error('Invalid socket authentication token'));
      }
    }

    // Direct fallback for userId if token is not available
    const fallbackUserId = socket.handshake.auth?.userId as string;
    if (fallbackUserId) {
      const user = await prisma.user.findUnique({ where: { id: fallbackUserId } });
      if (user) {
        socket.data.userId = user.id;
        socket.data.user = user;
        return next();
      }
    }

    return next(new Error('Authentication required for WebSocket connection'));
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const requestedWorkspaceId = socket.handshake.auth?.workspaceId as string;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Track user presence
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)?.add(socket.id);

    // Update user status to ONLINE in DB
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE' },
    }).catch(() => {});

    // Join user's OWN private room only
    socket.join(`user:${userId}`);

    // Join initial workspace if authorized
    if (requestedWorkspaceId) {
      const hasWsAccess = await canUserAccessWorkspace(userId, requestedWorkspaceId);
      if (hasWsAccess) {
        socket.join(`workspace:${requestedWorkspaceId}`);
        io.to(`workspace:${requestedWorkspaceId}`).emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
          userId,
          status: 'ONLINE',
        });
      }
    }

    // Join User Private Room (strictly constrained to authenticated user)
    socket.on('user:join', (uId: string) => {
      if (uId === userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Join Workspace Room (with membership authorization)
    socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (wId: string) => {
      const hasAccess = await canUserAccessWorkspace(userId, wId);
      if (hasAccess) {
        socket.join(`workspace:${wId}`);
      }
    });

    // Join Channel Room (with channel authorization)
    socket.on(SOCKET_EVENTS.JOIN_CHANNEL, async (channelId: string) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.join(`channel:${channelId}`);
      }
    });

    // Leave Channel Room
    socket.on(SOCKET_EVENTS.LEAVE_CHANNEL, (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    // Typing indicator
    socket.on(SOCKET_EVENTS.TYPING_START, async ({ channelId, username }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.TYPING_START, { channelId, username, userId });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, async ({ channelId }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.TYPING_STOP, { channelId, userId });
      }
    });

    // Whiteboard Live Collaboration
    socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, async ({ channelId, data }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.WHITEBOARD_UPDATE, { channelId, data, userId });
      }
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_CURSOR, async ({ channelId, cursor, user }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.WHITEBOARD_CURSOR, { channelId, cursor, user, userId });
      }
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, async ({ channelId }) => {
      const hasAccess = await canUserAccessChannel(userId, channelId);
      if (hasAccess) {
        socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, { channelId, userId });
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (userId && userSocketMap.has(userId)) {
        const sockets = userSocketMap.get(userId);
        sockets?.delete(socket.id);

        if (!sockets || sockets.size === 0) {
          userSocketMap.delete(userId);
          await prisma.user.update({
            where: { id: userId },
            data: { status: 'OFFLINE' },
          }).catch(() => {});

          if (requestedWorkspaceId) {
            io.to(`workspace:${requestedWorkspaceId}`).emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
              userId,
              status: 'OFFLINE',
            });
          }
        }
      }
    });
  });

  return io;
}
