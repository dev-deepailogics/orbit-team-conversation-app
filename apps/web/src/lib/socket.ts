import { io, Socket } from 'socket.io-client';
import { refreshAccessToken } from './api';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

let socket: Socket | null = null;
let currentWorkspaceId: string | undefined;

// `userId` is no longer sent: the server identifies the socket from the JWT only.
export function getSocket(_userId?: string, workspaceId?: string): Socket {
  if (workspaceId) currentWorkspaceId = workspaceId;

  if (!socket) {
    socket = io(SERVER_URL, {
      // Evaluated on every (re)connect so a refreshed token is always used.
      auth: (cb) =>
        cb({
          token: typeof window !== 'undefined' ? localStorage.getItem('orbit_token') : null,
          workspaceId: currentWorkspaceId,
        }),
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    // The handshake rejects an expired access token and socket.io won't retry on its own:
    // refresh once, then reconnect with the new token.
    let retrying = false;
    socket.on('connect_error', async (err) => {
      if (retrying || !/Invalid socket authentication token/i.test(err.message)) return;
      retrying = true;
      try {
        await refreshAccessToken();
        socket?.connect();
      } catch {
        // Refresh token is gone too: the api client's 401 handling will send the user to /login.
      } finally {
        retrying = false;
      }
    });
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
