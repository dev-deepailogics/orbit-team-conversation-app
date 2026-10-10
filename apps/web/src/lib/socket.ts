import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(userId?: string, workspaceId?: string): Socket {
  const token = typeof window !== 'undefined' ? localStorage.getItem('orbit_token') : null;

  if (!socket) {
    socket = io(SERVER_URL, {
      auth: {
        token,
        userId,
        workspaceId,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  } else {
    socket.auth = { token, userId, workspaceId };
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
