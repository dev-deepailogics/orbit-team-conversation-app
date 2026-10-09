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

  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  setActiveThread: (message: Message | null) => void;
  setThreadReplies: (replies: Message[]) => void;
  addThreadReply: (reply: Message) => void;
  setTypingUser: (channelId: string, username: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentWorkspace: null,
  channels: [],
  currentChannel: null,
  messages: [],
  activeThread: null,
  threadReplies: [],
  typingUsers: {},

  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channel) => set({ currentChannel: channel, activeThread: null }),
  setMessages: (messages) => set({ messages }),
  
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
}));
