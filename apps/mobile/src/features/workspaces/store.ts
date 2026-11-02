import { create } from 'zustand';
import type { Channel, Workspace } from '@orbit/types';
import { getErrorMessage } from '@/lib/api';
import { getUnread, getWorkspace, getWorkspaces } from './services/workspaceApi';
import type { WorkspaceDetail } from './types';

interface WorkspaceState {
  workspaces: Workspace[];
  current: WorkspaceDetail | null;
  // Seeded from the server on workspace open (lastReadAt), then bumped live by socket events.
  unread: Record<string, number>;
  isLoading: boolean;
  error: string;
  // Loads the list and opens `preferId`, else the current one, else the first.
  load: (preferId?: string) => Promise<void>;
  // silent: background refetch that leaves isLoading alone (no spinner on screens that bind to it).
  select: (workspaceId: string, silent?: boolean) => Promise<void>;
  upsertChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  reset: () => void;
}

// isLoading starts true: MainTabs loads on mount, and this avoids flashing the "no workspace" state first.
const initial = { workspaces: [], current: null, unread: {}, isLoading: true, error: '' };

let selectSeq = 0;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initial,

  load: async preferId => {
    set({ isLoading: true, error: '' });
    try {
      const workspaces = await getWorkspaces();
      set({ workspaces });
      const target =
        workspaces.find(w => w.id === preferId) ?? workspaces.find(w => w.id === get().current?.id) ?? workspaces[0];
      if (target) {
        await get().select(target.id);
      } else {
        set({ current: null, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to load workspaces') });
    }
  },

  // ponytail: last-opened workspace isn't persisted (no AsyncStorage yet); app reopens on the first one.
  select: async (workspaceId, silent) => {
    const req = ++selectSeq;
    set(silent ? { error: '' } : { isLoading: true, error: '' });
    try {
      const [current, counts] = await Promise.all([
        getWorkspace(workspaceId),
        // Counts are a nicety: if they fail, keep what we have rather than failing the whole open.
        getUnread(workspaceId).catch(() => null),
      ]);
      if (req !== selectSeq) return; // a newer switch won
      const sameWorkspace = get().current?.id === workspaceId;
      set({ current, unread: counts ?? (sameWorkspace ? get().unread : {}), isLoading: false });
    } catch (err) {
      if (req !== selectSeq) return;
      set({ isLoading: false, error: getErrorMessage(err, 'Failed to open workspace') });
    }
  },

  upsertChannel: channel =>
    set(s => {
      if (!s.current || channel.workspaceId !== s.current.id) return s;
      const exists = s.current.channels.some(c => c.id === channel.id);
      const channels = exists
        ? s.current.channels.map(c => (c.id === channel.id ? { ...c, ...channel } : c))
        : [...s.current.channels, channel];
      return { current: { ...s.current, channels } };
    }),

  removeChannel: channelId =>
    set(s =>
      s.current ? { current: { ...s.current, channels: s.current.channels.filter(c => c.id !== channelId) } } : s,
    ),

  incrementUnread: channelId => set(s => ({ unread: { ...s.unread, [channelId]: (s.unread[channelId] ?? 0) + 1 } })),

  clearUnread: channelId => set(s => (s.unread[channelId] ? { unread: { ...s.unread, [channelId]: 0 } } : s)),

  reset: () => set(initial),
}));
