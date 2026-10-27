import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './config';

// Mirrors SOCKET_EVENTS in @orbit/types: Metro can't import runtime values from that package (see AGENTS.md),
// and the server emits a few raw strings (message:updated/deleted, channel:deleted) that aren't in it.
export const EVENTS = {
  JOIN_CHANNEL: 'channel:join',
  LEAVE_CHANNEL: 'channel:leave',
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_REACTION: 'message:reaction',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  CHANNEL_NEW: 'channel:new',
  CHANNEL_UPDATED: 'channel:updated',
  CHANNEL_DELETED: 'channel:deleted',
} as const;

let socket: Socket | null = null;

// The server joins `user:<id>` and the handshake's `workspace:<id>` room on connect (apps/server/src/socket/index.ts),
// and re-runs that on every auto-reconnect. Switching workspace = new connection, so the old workspace room is dropped.
export function connectSocket(token: string, workspaceId: string): Socket {
  socket?.disconnect();
  socket = io(SERVER_URL, { auth: { token, workspaceId }, transports: ['websocket'] });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
