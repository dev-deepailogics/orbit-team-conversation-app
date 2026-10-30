import { useEffect } from 'react';
import type { Channel, Message, Project, ProjectColumn, Reaction, Ticket } from '@orbit/types';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { connectSocket, disconnectSocket, EVENTS } from '@/lib/socket';
import { markChannelRead } from '@/features/workspaces/services/workspaceApi';
import { useProjectStore } from '@/features/projects/store';
import { useChatStore } from '../store';
import { isMine } from '../utils';

// Typing stop can be lost (app killed, network drop); clear stale indicators ourselves.
const TYPING_TTL_MS = 6000;

// One socket per signed-in session + workspace. Mounted once in MainTabs; unmounting (sign-out) disconnects.
export function useRealtime() {
  const token = useAuthStore(s => s.token);
  const myId = useAuthStore(s => s.user?.id);
  const workspaceId = useWorkspaceStore(s => s.current?.id);

  useEffect(() => {
    if (!token || !workspaceId) return;
    const socket = connectSocket(token, workspaceId);
    const chat = useChatStore.getState;
    const ws = useWorkspaceStore.getState;
    // Private/DM messages reach us via both the user and channel rooms; count each once.
    // ponytail: grows for the session's lifetime; cap it if sessions run for days.
    const counted = new Set<string>();
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearTyping = (channelId: string, userId: string) => {
      clearTimeout(typingTimers.get(userId));
      typingTimers.delete(userId);
      chat().setTyping(channelId, userId, null);
    };

    // Channel rooms (typing, reactions, thread replies) are lost on reconnect; rejoin the open one.
    socket.on('connect', () => {
      const open = chat().channelId;
      if (open) socket.emit(EVENTS.JOIN_CHANNEL, open);
    });

    socket.on(EVENTS.MESSAGE_NEW, (m: Message) => {
      chat().receiveMessage(m);
      const unseen = !m.parentMessageId && m.channelId !== chat().channelId && !isMine(m, myId);
      // Open channel: keep the server's lastReadAt current so a kill mid-chat doesn't resurrect these as unread.
      if (!m.parentMessageId && m.channelId === chat().channelId && !isMine(m, myId)) {
        markChannelRead(m.channelId).catch(() => {});
      }
      if (unseen && !counted.has(m.id)) {
        counted.add(m.id);
        ws().incrementUnread(m.channelId);
      }
    });
    socket.on(EVENTS.MESSAGE_UPDATED, (m: Message) => chat().updateMessage(m));
    socket.on(EVENTS.MESSAGE_DELETED, (p: { message?: Message }) => p.message && chat().updateMessage(p.message));
    socket.on(EVENTS.MESSAGE_REACTION, (p: { messageId: string; reactions: Reaction[] }) =>
      chat().setReactions(p.messageId, p.reactions),
    );

    socket.on(EVENTS.CHANNEL_NEW, (c: Channel) => ws().upsertChannel(c));
    socket.on(EVENTS.CHANNEL_UPDATED, (c: Channel) => ws().upsertChannel(c));
    socket.on(EVENTS.CHANNEL_DELETED, (p: { channelId: string }) => ws().removeChannel(p.channelId));

    socket.on(EVENTS.TYPING_START, (p: { channelId: string; userId: string; username: string }) => {
      if (p.userId === myId) return;
      chat().setTyping(p.channelId, p.userId, p.username);
      clearTimeout(typingTimers.get(p.userId));
      typingTimers.set(p.userId, setTimeout(() => clearTyping(p.channelId, p.userId), TYPING_TTL_MS));
    });
    socket.on(EVENTS.TYPING_STOP, (p: { channelId: string; userId: string }) => clearTyping(p.channelId, p.userId));

    const proj = useProjectStore.getState;
    socket.on(EVENTS.PROJECT_NEW, (p: Project) => proj().upsertProject(p));
    socket.on(EVENTS.PROJECT_UPDATE, (p: Project) => proj().upsertProject(p));
    socket.on(EVENTS.PROJECT_DELETE, (p: { projectId: string }) => proj().removeProject(p.projectId));
    socket.on(EVENTS.COLUMN_NEW, (c: ProjectColumn) => proj().addColumn(c));
    socket.on(EVENTS.COLUMN_UPDATE, (c: ProjectColumn) => proj().updateColumn(c));
    socket.on(EVENTS.COLUMN_DELETE, (p: { columnId: string }) => proj().removeColumn(p.columnId));
    socket.on(EVENTS.COLUMN_REORDER, (p: { projectId: string; columns: ProjectColumn[] }) =>
      proj().setColumnOrder(p.projectId, p.columns.map(c => c.id)),
    );
    socket.on(EVENTS.TICKET_NEW, (t: Ticket) => proj().addTicket(t));
    socket.on(EVENTS.TICKET_UPDATE, (t: Ticket) => proj().updateTicket(t));
    socket.on(EVENTS.TICKET_DELETE, (p: { ticketId: string }) => proj().removeTicket(p.ticketId));
    socket.on(EVENTS.TICKET_MOVE, (p: { ticket: Ticket; toColumnId: string; orderIndex: number }) =>
      proj().moveTicket(p.ticket, p.toColumnId, p.orderIndex),
    );

    return () => {
      typingTimers.forEach(clearTimeout);
      disconnectSocket();
    };
  }, [token, workspaceId, myId]);
}
