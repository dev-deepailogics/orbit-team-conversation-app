import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@orbit/db';
import { SOCKET_EVENTS } from '@orbit/types';

export function setupSocketServer(io: SocketIOServer) {
  // Store connected user socket mapping
  const userSocketMap = new Map<string, Set<string>>();

  io.on('connection', async (socket: Socket) => {
    const userId = socket.handshake.auth?.userId as string;
    const workspaceId = socket.handshake.auth?.workspaceId as string;

    if (!userId) {
      // Allow anonymous connection only if needed, or disconnect
    } else {
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

      if (workspaceId) {
        socket.join(`workspace:${workspaceId}`);
        io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
          userId,
          status: 'ONLINE',
        });
      }
    }

    // Join Workspace Room
    socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, (wId: string) => {
      socket.join(`workspace:${wId}`);
    });

    // Join Channel Room
    socket.on(SOCKET_EVENTS.JOIN_CHANNEL, (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    // Leave Channel Room
    socket.on(SOCKET_EVENTS.LEAVE_CHANNEL, (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    // Typing indicator
    socket.on(SOCKET_EVENTS.TYPING_START, ({ channelId, username }) => {
      socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.TYPING_START, { channelId, username, userId });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit(SOCKET_EVENTS.TYPING_STOP, { channelId, userId });
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

          if (workspaceId) {
            io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
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
