import { create } from 'zustand';
import { Workspace, Channel, Message } from '@orbit/types';

export interface TypingUser {
  userId: string;
  username: string;
}

interface ChatState {
  currentWorkspace: Workspace | null;
  channels: Channel[];
  currentChannel: Channel | null;
  messages: Message[];
  activeThread: Message | null;
  threadReplies: Message[];
  // Who is typing per channel, keyed by user id (typing:stop only carries the id, not the name)
  typingUsers: { [channelId: string]: TypingUser[] };
  unreadCounts: { [channelId: string]: number };

  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setChannels: (channels: Channel[]) => void;
  updateChannel: (channel: Channel) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  prependMessages: (olderMessages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  setActiveThread: (message: Message | null) => void;
  // threadId: the thread these replies were fetched for; ignored if the open thread has changed since
  setThreadReplies: (replies: Message[], threadId?: string) => void;
  addThreadReply: (reply: Message) => void;
  setTypingUser: (channelId: string, user: TypingUser, isTyping: boolean) => void;
  incrementUnread: (messageId: string, channelId: string) => void;
  clearUnread: (channelId: string) => void;
  removeAttachment: (fileId: string) => void;
  reset: () => void;
}

// Thread replies already counted, so a reply delivered twice doesn't bump a reply count twice (bounded, oldest dropped)
const countedReplyIds = new Set<string>();

export const useChatStore = create<ChatState>((set) => ({
  currentWorkspace: null,
  channels: [],
  currentChannel: null,
  messages: [],
  activeThread: null,
  threadReplies: [],
  typingUsers: {},
  unreadCounts: {},

  reset: () =>
    set({
      currentWorkspace: null,
      channels: [],
      currentChannel: null,
      messages: [],
      activeThread: null,
      threadReplies: [],
      typingUsers: {},
      unreadCounts: {},
    }),

  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setChannels: (channels) => set({ channels }),
  updateChannel: (channel) =>
    set((state) => ({
      channels: state.channels.map((c) => (c.id === channel.id ? channel : c)),
      currentChannel: state.currentChannel?.id === channel.id ? channel : state.currentChannel,
    })),
  setCurrentChannel: (channel) =>
    set((state) => ({
      currentChannel: channel,
      activeThread: null,
      unreadCounts: channel
        ? { ...state.unreadCounts, [channel.id]: 0 }
        : state.unreadCounts,
    })),
  setMessages: (messages) => set({ messages }),
  
  prependMessages: (olderMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const uniqueOlder = olderMessages.filter((m) => !existingIds.has(m.id));
      return { messages: [...uniqueOlder, ...state.messages] };
    }),

  addMessage: (message) =>
    set((state) => {
      // Don't duplicate
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  updateMessage: (message) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === message.id ? message : m)),
      threadReplies: state.threadReplies.map((r) => (r.id === message.id ? message : r)),
      activeThread: state.activeThread?.id === message.id ? { ...state.activeThread, ...message } : state.activeThread,
    })),

  removeAttachment: (fileId) =>
    set((state) => ({
      messages: state.messages.map((m) => ({
        ...m,
        attachments: m.attachments?.filter((a) => a.id !== fileId),
      })),
      threadReplies: state.threadReplies.map((r) => ({
        ...r,
        attachments: r.attachments?.filter((a) => a.id !== fileId),
      })),
      activeThread: state.activeThread
        ? {
            ...state.activeThread,
            attachments: state.activeThread.attachments?.filter((a) => a.id !== fileId),
          }
        : null,
    })),

  setActiveThread: (message) =>
    set((state) => ({
      activeThread: message,
      // Opening a different thread (or closing it): drop the previous thread's replies right away instead of showing
      // them under the new parent until its own replies finish loading
      threadReplies: state.activeThread?.id === message?.id ? state.threadReplies : [],
    })),
  setThreadReplies: (replies, threadId) =>
    set((state) => {
      // A slow response for a thread that is no longer open must not overwrite the one that is
      if (threadId && state.activeThread?.id !== threadId) return state;
      return { threadReplies: replies };
    }),

  addThreadReply: (reply) =>
    set((state) => {
      // A reply can arrive more than once (the HTTP response plus the socket echo, anonymous channels send two copies)
      if (countedReplyIds.has(reply.id)) return state;
      countedReplyIds.add(reply.id);
      if (countedReplyIds.size > 1000) countedReplyIds.delete(countedReplyIds.values().next().value as string);

      // Every thread reply in the workspace reaches this client, so only add it to the open thread's list when it is
      // a reply to that thread; the reply count on the parent message is bumped either way.
      const inOpenThread =
        state.activeThread?.id === reply.parentMessageId && !state.threadReplies.some((r) => r.id === reply.id);
      return {
        threadReplies: inOpenThread ? [...state.threadReplies, reply] : state.threadReplies,
        messages: state.messages.map((m) =>
          m.id === reply.parentMessageId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        ),
      };
    }),

  setTypingUser: (channelId, user, isTyping) =>
    set((state) => {
      const existing = state.typingUsers[channelId] || [];
      const others = existing.filter((u) => u.userId !== user.userId);
      // Nothing to change when removing someone who isn't listed (avoids a re-render for every stop event)
      if (!isTyping && others.length === existing.length) return state;
      const updated = isTyping ? [...others, user] : others;
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: updated,
        },
      };
    }),

  incrementUnread: (messageId: string, channelId: string) =>
    set((state) => {
      // If message was already processed, do not increment again
      if ((state as any)._seenMessageIds?.has(messageId)) {
        return state;
      }
      const seen = new Set((state as any)._seenMessageIds || []);
      seen.add(messageId);

      return {
        _seenMessageIds: seen,
        unreadCounts: {
          ...state.unreadCounts,
          [channelId]: (state.unreadCounts[channelId] || 0) + 1,
        },
      };
    }),

  clearUnread: (channelId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: 0,
      },
    })),
}));
