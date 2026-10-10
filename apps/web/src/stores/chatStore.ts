import { create } from 'zustand';
import { Workspace, Channel, Message } from '@orbit/types';

interface ChatState {
  currentWorkspace: Workspace | null;
  channels: Channel[];
  currentChannel: Channel | null;
  messages: Message[];
  activeThread: Message | null;
  threadReplies: Message[];
  typingUsers: { [channelId: string]: string[] };
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
  setThreadReplies: (replies: Message[]) => void;
  addThreadReply: (reply: Message) => void;
  setTypingUser: (channelId: string, username: string, isTyping: boolean) => void;
  incrementUnread: (messageId: string, channelId: string) => void;
  clearUnread: (channelId: string) => void;
  removeAttachment: (fileId: string) => void;
  reset: () => void;
}

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

  setActiveThread: (message) => set({ activeThread: message }),
  setThreadReplies: (replies) => set({ threadReplies: replies }),
  
  addThreadReply: (reply) =>
    set((state) => {
      if (state.threadReplies.some((r) => r.id === reply.id)) {
        return state;
      }
      return {
        threadReplies: [...state.threadReplies, reply],
        messages: state.messages.map((m) =>
          m.id === reply.parentMessageId
            ? { ...m, replyCount: (m.replyCount || 0) + 1 }
            : m
        ),
      };
    }),

  setTypingUser: (channelId, username, isTyping) =>
    set((state) => {
      const existing = state.typingUsers[channelId] || [];
      const updated = isTyping
        ? Array.from(new Set([...existing, username]))
        : existing.filter((u) => u !== username);
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
