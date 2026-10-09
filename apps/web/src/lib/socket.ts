import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(userId?: string, workspaceId?: string): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      auth: {
        userId,
        workspaceId,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  } else if (userId || workspaceId) {
    socket.auth = { userId, workspaceId };
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
