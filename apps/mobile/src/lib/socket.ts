import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './config';
import { getAuthToken, refreshAuthToken } from './api';

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
  PROJECT_NEW: 'project:new',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  TICKET_NEW: 'ticket:new',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_MOVE: 'ticket:move',
  COLUMN_NEW: 'column:new',
  COLUMN_UPDATE: 'column:update',
  COLUMN_DELETE: 'column:delete',
  COLUMN_REORDER: 'column:reorder',
  HUDDLE_STARTED: 'huddle:started',
  HUDDLE_ENDED: 'huddle:ended',
  HUDDLE_JOINED: 'huddle:joined',
  HUDDLE_LEFT: 'huddle:left',
  AVAILABILITY_UPDATE: 'availability:update',
} as const;

let socket: Socket | null = null;

// The server joins `user:<id>` and the handshake's `workspace:<id>` room on connect (apps/server/src/socket/index.ts),
// and re-runs that on every auto-reconnect. Switching workspace = new connection, so the old workspace room is dropped.
export function connectSocket(token: string, workspaceId: string): Socket {
  socket?.disconnect();
  // Auth is a function so every (auto-)reconnect handshakes with the latest, possibly refreshed, token.
  const next = io(SERVER_URL, {
    auth: (cb) => cb({ token: getAuthToken() ?? token, workspaceId }),
    transports: ['websocket'],
  });
  socket = next;

  // An expired access token is rejected in the handshake and socket.io won't retry by itself:
  // refresh once, then reconnect.
  let retrying = false;
  next.on('connect_error', async (err) => {
    if (retrying || !/Invalid socket authentication token/i.test(err.message)) return;
    retrying = true;
    try {
      if (await refreshAuthToken()) next.connect();
    } catch {
      // Refresh failed; the auth store's 401 handling signs the user out.
    } finally {
      retrying = false;
    }
  });
  return next;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
