import { create } from 'zustand';
import { Workspace, Channel, Message, MessagePoll } from '@orbit/types';

export interface ThreadPage {
  hasMore: boolean;
  nextCursor: string | null;
}

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
  threadHasMore: boolean;
  threadNextCursor: string | null;
  /** The open thread's first page of replies hasn't arrived yet (drives the thread skeleton). */
  threadLoading: boolean;
  // Who is typing per channel, keyed by user id (typing:stop only carries the id, not the name)
  typingUsers: { [channelId: string]: TypingUser[] };
  unreadCounts: { [channelId: string]: number };
  /** When each conversation last had a top-level message (epoch ms); drives "recent" sidebar sorting. */
  lastActivity: { [channelId: string]: number };

  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setChannels: (channels: Channel[]) => void;
  updateChannel: (channel: Channel) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  prependMessages: (olderMessages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  /** New poll results (from a vote response or a poll:updated broadcast). */
  applyPollUpdate: (messageId: string, poll: MessagePoll) => void;
  /** New reactions for a message, wherever it's shown: the channel, a thread's replies, or the open thread's parent. */
  applyReactions: (messageId: string, reactions: Message['reactions']) => void;
  setActiveThread: (message: Message | null) => void;
  // threadId: the thread these replies were fetched for; ignored if the open thread has changed since.
  // page: whether older replies exist and where to continue from (replies load newest-first, like channel messages)
  setThreadReplies: (replies: Message[], threadId?: string, page?: ThreadPage) => void;
  prependThreadReplies: (older: Message[], threadId: string, page: ThreadPage) => void;
  addThreadReply: (reply: Message) => void;
  setTypingUser: (channelId: string, user: TypingUser, isTyping: boolean) => void;
  incrementUnread: (messageId: string, channelId: string) => void;
  clearUnread: (channelId: string) => void;
  /** Replace all counts with the server's (the open channel stays at 0). */
  setUnreadCounts: (counts: { [channelId: string]: number }) => void;
  setLastActivity: (activity: { [channelId: string]: number }) => void;
  /** Record a new message's time; never moves a conversation's time backwards (messages arrive twice, out of order). */
  bumpActivity: (channelId: string, at: number) => void;
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
  threadHasMore: false,
  threadNextCursor: null,
  threadLoading: false,
  typingUsers: {},
  unreadCounts: {},
  lastActivity: {},

  reset: () =>
    set({
      currentWorkspace: null,
      channels: [],
      currentChannel: null,
      messages: [],
      activeThread: null,
      threadReplies: [],
      threadHasMore: false,
      threadNextCursor: null,
      threadLoading: false,
      typingUsers: {},
      unreadCounts: {},
      lastActivity: {},
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
      threadLoading: false,
      unreadCounts: channel
        ? { ...state.unreadCounts, [channel.id]: 0 }
        : state.unreadCounts,
    })),
  setUnreadCounts: (counts) =>
    set((state) => ({
      unreadCounts: state.currentChannel ? { ...counts, [state.currentChannel.id]: 0 } : counts,
    })),
  setLastActivity: (activity) => set({ lastActivity: activity }),
  bumpActivity: (channelId, at) =>
    set((state) =>
      (state.lastActivity[channelId] ?? 0) >= at ? state : { lastActivity: { ...state.lastActivity, [channelId]: at } },
    ),
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
      // Edit/pin/delete payloads don't carry the poll, so keep the one already shown
      messages: state.messages.map((m) =>
        m.id !== message.id ? m : message.poll === undefined && m.poll ? { ...message, poll: m.poll } : message,
      ),
      threadReplies: state.threadReplies.map((r) => (r.id === message.id ? message : r)),
      activeThread: state.activeThread?.id === message.id ? { ...state.activeThread, ...message } : state.activeThread,
    })),

  applyPollUpdate: (messageId, poll) =>
    set((state) => {
      const isTarget = (m: Message | null): m is Message => !!m?.poll && m.id === messageId;
      if (!state.messages.some(isTarget) && !isTarget(state.activeThread)) return state;
      // A broadcast carries no "my votes" (it goes to everyone): keep this viewer's own choice
      const withPoll = (m: Message): Message => ({ ...m, poll: { ...poll, myVotes: poll.myVotes ?? m.poll?.myVotes } });
      return {
        messages: state.messages.map((m) => (isTarget(m) ? withPoll(m) : m)),
        activeThread: isTarget(state.activeThread) ? withPoll(state.activeThread) : state.activeThread,
      };
    }),

  applyReactions: (messageId, reactions) =>
    set((state) => {
      const apply = (m: Message) => (m.id === messageId ? { ...m, reactions } : m);
      return {
        messages: state.messages.map(apply),
        threadReplies: state.threadReplies.map(apply),
        activeThread: state.activeThread && apply(state.activeThread),
      };
    }),

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
      // them under the new parent until its own replies finish loading (setThreadReplies ends the loading state)
      ...(state.activeThread?.id === message?.id
        ? {}
        : { threadReplies: [], threadHasMore: false, threadNextCursor: null, threadLoading: !!message }),
    })),
  setThreadReplies: (replies, threadId, page) =>
    set((state) => {
      // A slow response for a thread that is no longer open must not overwrite the one that is
      if (threadId && state.activeThread?.id !== threadId) return state;
      return {
        threadReplies: replies,
        threadHasMore: page?.hasMore ?? false,
        threadNextCursor: page?.nextCursor ?? null,
        threadLoading: false,
      };
    }),
  prependThreadReplies: (older, threadId, page) =>
    set((state) => {
      if (state.activeThread?.id !== threadId) return state;
      const have = new Set(state.threadReplies.map((r) => r.id));
      return {
        threadReplies: [...older.filter((r) => !have.has(r.id)), ...state.threadReplies],
        threadHasMore: page.hasMore,
        threadNextCursor: page.nextCursor,
      };
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
