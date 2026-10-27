import { useEffect } from 'react';
import type { Channel, Message, Reaction } from '@orbit/types';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { connectSocket, disconnectSocket, EVENTS } from '@/lib/socket';
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

    return () => {
      typingTimers.forEach(clearTimeout);
      disconnectSocket();
    };
  }, [token, workspaceId, myId]);
}
