import { create } from 'zustand';
import type { Message, Reaction } from '@orbit/types';
import { getErrorMessage } from '@/lib/api';
import { getMessages, getThread } from './services/chatApi';

interface ThreadState {
  parentId: string | null;
  parent: Message | null;
  replies: Message[];
  isLoading: boolean;
  error: string;
}

interface ChatState {
  // Only the open channel's messages are kept; reopening a channel refetches.
  channelId: string | null;
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingOlder: boolean;
  error: string;
  typing: Record<string, string>; // userId → display name, open channel only
  thread: ThreadState;

  openChannel: (channelId: string) => Promise<void>;
  closeChannel: (channelId: string) => void;
  loadOlder: () => Promise<void>;
  receiveMessage: (m: Message) => void;
  updateMessage: (m: Message) => void;
  setReactions: (messageId: string, reactions: Reaction[]) => void;
  setTyping: (channelId: string, userId: string, name: string | null) => void;
  openThread: (parentId: string) => Promise<void>;
  closeThread: (parentId: string) => void;
  reset: () => void;
}

const emptyThread: ThreadState = { parentId: null, parent: null, replies: [], isLoading: false, error: '' };
const initial = {
  channelId: null,
  messages: [],
  hasMore: false,
  nextCursor: null,
  isLoading: false,
  isLoadingOlder: false,
  error: '',
  typing: {},
  thread: emptyThread,
};

// A message can arrive twice (HTTP response + socket echo; anonymous channels also send the author a
// masked copy and a self copy). Keep one, preferring the copy that knows it's ours.
export function addUnique(list: Message[], m: Message): Message[] {
  const i = list.findIndex(x => x.id === m.id);
  if (i === -1) return [...list, m];
  if (m.isSelf && !list[i].isSelf) return list.map((x, j) => (j === i ? m : x));
  return list;
}

const merge = (list: Message[], m: Message) =>
  list.map(x => (x.id === m.id ? { ...x, ...m, isSelf: x.isSelf || m.isSelf } : x));

const bumpReplies = (m: Message, parentId: string) =>
  m.id === parentId ? { ...m, replyCount: (m.replyCount ?? 0) + 1, latestReplyAt: new Date().toISOString() } : m;

export const useChatStore = create<ChatState>((set, get) => ({
  ...initial,

  openChannel: async channelId => {
    set({ ...initial, channelId, isLoading: true });
    try {
      const page = await getMessages(channelId);
      if (get().channelId !== channelId) return; // user already moved on
      set(s => ({
        // Keep anything the socket delivered while the first page was loading.
        messages: s.messages.reduce(addUnique, page.messages),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
        isLoading: false,
      }));
    } catch (err) {
      if (get().channelId !== channelId) return;
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to load messages') });
    }
  },

  // Guarded so a screen unmounting late can't wipe a channel opened after it.
  closeChannel: channelId => {
    if (get().channelId === channelId) set(initial);
  },

  loadOlder: async () => {
    const { channelId, hasMore, nextCursor, isLoadingOlder, isLoading } = get();
    if (!channelId || !hasMore || isLoadingOlder || isLoading) return;
    set({ isLoadingOlder: true });
    try {
      const page = await getMessages(channelId, nextCursor);
      if (get().channelId !== channelId) return;
      set(s => ({
        messages: s.messages.reduce(addUnique, page.messages),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
        isLoadingOlder: false,
      }));
    } catch {
      // Silent: the user can scroll up again to retry; the visible history is unaffected.
      if (get().channelId === channelId) set({ isLoadingOlder: false });
    }
  },

  receiveMessage: m =>
    set(s => {
      if (m.parentMessageId) {
        const parentId = m.parentMessageId;
        const inThread = s.thread.parentId === parentId;
        // When the thread is open its reply list dedupes; otherwise each reply arrives once (socket only).
        const isNew = !inThread || !s.thread.replies.some(r => r.id === m.id);
        return {
          thread: inThread
            ? {
                ...s.thread,
                replies: addUnique(s.thread.replies, m),
                parent: s.thread.parent && isNew ? bumpReplies(s.thread.parent, parentId) : s.thread.parent,
              }
            : s.thread,
          messages: isNew ? s.messages.map(x => bumpReplies(x, parentId)) : s.messages,
        };
      }
      if (m.channelId !== s.channelId) return s;
      return { messages: addUnique(s.messages, m) };
    }),

  updateMessage: m =>
    set(s => ({
      messages: merge(s.messages, m),
      thread: {
        ...s.thread,
        replies: merge(s.thread.replies, m),
        parent: s.thread.parent?.id === m.id ? { ...s.thread.parent, ...m } : s.thread.parent,
      },
    })),

  setReactions: (messageId, reactions) => {
    const apply = (x: Message) => (x.id === messageId ? { ...x, reactions } : x);
    set(s => ({
      messages: s.messages.map(apply),
      thread: { ...s.thread, replies: s.thread.replies.map(apply), parent: s.thread.parent && apply(s.thread.parent) },
    }));
  },

  setTyping: (channelId, userId, name) =>
    set(s => {
      if (channelId !== s.channelId) return s;
      const typing = { ...s.typing };
      if (name) typing[userId] = name;
      else delete typing[userId];
      return { typing };
    }),

  openThread: async parentId => {
    const parent = get().messages.find(m => m.id === parentId) ?? null;
    set({ thread: { ...emptyThread, parentId, parent, isLoading: true } });
    try {
      const data = await getThread(parentId);
      if (get().thread.parentId !== parentId) return;
      set(s => ({
        thread: { ...s.thread, parent: data.parent, replies: s.thread.replies.reduce(addUnique, data.replies), isLoading: false },
      }));
    } catch (err) {
      if (get().thread.parentId !== parentId) return;
      set(s => ({ thread: { ...s.thread, isLoading: false, error: getErrorMessage(err, 'Failed to load thread') } }));
    }
  },

  closeThread: parentId => {
    if (get().thread.parentId === parentId) set({ thread: emptyThread });
  },

  reset: () => set(initial),
}));
