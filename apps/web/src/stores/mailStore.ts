import { create } from "zustand";
import {
  MailAccount,
  MailFolder,
  MailMessage,
  MailFolderSpecialUse,
  SendMailInput,
} from "@orbit/types";
import { api } from "@/lib/api";

interface MailState {
  accounts: MailAccount[];
  activeAccountId: string | null; // null means "All Inboxes"
  folders: MailFolder[];
  activeFolderId: string | null;
  activeSpecialUse: MailFolderSpecialUse | "ALL" | null;
  filter: "all" | "unread" | "starred" | "attachments";
  searchQuery: string;

  messages: MailMessage[];
  selectedMessage: MailMessage | null;
  totalMessages: number;
  page: number;
  limit: number;

  isLoadingAccounts: boolean;
  isLoadingMessages: boolean;
  isLoadingDetail: boolean;
  isSyncing: boolean;

  showComposeModal: boolean;
  composeDraft: Partial<SendMailInput> | null;
  showAddAccountModal: boolean;

  // Actions
  fetchAccounts: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchMessages: (pageNumber?: number) => Promise<void>;
  fetchMessageDetail: (id: string) => Promise<void>;
  setActiveAccount: (accountId: string | null) => void;
  setActiveFolder: (folderId: string | null, specialUse?: MailFolderSpecialUse | "ALL" | null) => void;
  selectAccountFolder: (accountId: string | null, folderId: string | null, specialUse?: MailFolderSpecialUse | "ALL" | null) => void;
  setFilter: (filter: "all" | "unread" | "starred" | "attachments") => void;
  setSearchQuery: (query: string) => void;
  setSelectedMessage: (msg: MailMessage | null) => void;

  toggleRead: (id: string, isRead: boolean) => Promise<void>;
  toggleStar: (id: string, isStarred: boolean) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  moveMessage: (id: string, targetFolderId: string) => Promise<void>;
  bulkAction: (action: "read" | "unread" | "star" | "unstar" | "delete" | "move", messageIds: string[], targetFolderId?: string) => Promise<void>;

  triggerSync: (accountId?: string) => Promise<void>;
  openCompose: (initialData?: Partial<SendMailInput>) => void;
  closeCompose: () => void;
  openAddAccount: () => void;
  closeAddAccount: () => void;
}

export const useMailStore = create<MailState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  folders: [],
  activeFolderId: null,
  activeSpecialUse: "INBOX",
  filter: "all",
  searchQuery: "",

  messages: [],
  selectedMessage: null,
  totalMessages: 0,
  page: 1,
  limit: 30,

  isLoadingAccounts: false,
  isLoadingMessages: false,
  isLoadingDetail: false,
  isSyncing: false,

  showComposeModal: false,
  composeDraft: null,
  showAddAccountModal: false,

  fetchAccounts: async () => {
    set({ isLoadingAccounts: true });
    try {
      const res = await api.get<MailAccount[]>("/api/mail/accounts");
      set({ accounts: res.data, isLoadingAccounts: false });
      if (res.data.length > 0 && get().folders.length === 0) {
        await get().fetchFolders();
      }
    } catch (err) {
      set({ isLoadingAccounts: false });
    }
  },

  fetchFolders: async () => {
    try {
      const res = await api.get<MailFolder[]>("/api/mail/folders");
      set({ folders: res.data });
    } catch {
      // Quiet fail
    }
  },

  fetchMessages: async (pageNumber = 1) => {
    set({ isLoadingMessages: true, page: pageNumber });
    const { activeAccountId, activeFolderId, activeSpecialUse, filter, searchQuery, limit } = get();

    try {
      const params: any = {
        page: pageNumber,
        limit,
      };
      if (activeAccountId) params.accountId = activeAccountId;
      if (activeFolderId) {
        params.folderId = activeFolderId;
      } else if (activeSpecialUse && activeSpecialUse !== "ALL") {
        params.specialUse = activeSpecialUse;
      }
      if (filter !== "all") params.filter = filter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get<{
        messages: MailMessage[];
        total: number;
        page: number;
        totalPages: number;
      }>("/api/mail/messages", { params });

      set({
        messages: res.data.messages,
        totalMessages: res.data.total,
        isLoadingMessages: false,
      });

      // Keep selection in sync or reset if current selected not in list
      const currentSelected = get().selectedMessage;
      if (currentSelected && !res.data.messages.some((m) => m.id === currentSelected.id)) {
        // Keep selected message
      } else if (!currentSelected && res.data.messages.length > 0) {
        // Automatically select first on wide screens
        get().fetchMessageDetail(res.data.messages[0].id);
      }
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  fetchMessageDetail: async (id: string) => {
    set({ isLoadingDetail: true });
    try {
      const res = await api.get<MailMessage>(`/api/mail/messages/${id}`);
      set((state) => ({
        selectedMessage: res.data,
        isLoadingDetail: false,
        // Mark as read in list too
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, isRead: true } : m
        ),
      }));
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  setActiveAccount: (accountId) => {
    set({ activeAccountId: accountId, selectedMessage: null });
    get().fetchFolders().then(() => get().fetchMessages(1));
  },

  setActiveFolder: (folderId, specialUse = null) => {
    set({
      activeFolderId: folderId,
      activeSpecialUse: specialUse,
      selectedMessage: null,
    });
    get().fetchMessages(1);
  },

  selectAccountFolder: (accountId, folderId, specialUse = null) => {
    set({
      activeAccountId: accountId,
      activeFolderId: folderId,
      activeSpecialUse: specialUse,
      selectedMessage: null,
    });
    get().fetchMessages(1);
  },

  setFilter: (filter) => {
    set({ filter, selectedMessage: null });
    get().fetchMessages(1);
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    get().fetchMessages(1);
  },

  setSelectedMessage: (selectedMessage) => {
    set({ selectedMessage });
  },

  toggleRead: async (id, isRead) => {
    try {
      await api.patch(`/api/mail/messages/${id}`, { isRead });
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, isRead } : m
        ),
        selectedMessage:
          state.selectedMessage?.id === id
            ? { ...state.selectedMessage, isRead }
            : state.selectedMessage,
      }));
    } catch {
      // Revert if error
    }
  },

  toggleStar: async (id, isStarred) => {
    try {
      await api.patch(`/api/mail/messages/${id}`, { isStarred });
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, isStarred } : m
        ),
        selectedMessage:
          state.selectedMessage?.id === id
            ? { ...state.selectedMessage, isStarred }
            : state.selectedMessage,
      }));
    } catch {
      // Revert
    }
  },

  deleteMessage: async (id) => {
    try {
      await api.post("/api/mail/messages/bulk", {
        messageIds: [id],
        action: "delete",
      });
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id),
        selectedMessage:
          state.selectedMessage?.id === id ? null : state.selectedMessage,
        totalMessages: Math.max(0, state.totalMessages - 1),
      }));
    } catch {
      // Error
    }
  },

  deleteAccount: async (id: string) => {
    try {
      await api.delete(`/api/mail/accounts/${id}`);
      const remainingAccounts = get().accounts.filter((a) => a.id !== id);
      set({
        accounts: remainingAccounts,
        activeAccountId: get().activeAccountId === id ? null : get().activeAccountId,
      });
      await get().fetchFolders();
      await get().fetchMessages(1);
    } catch (err) {
      console.error("Failed to delete account", err);
    }
  },

  moveMessage: async (id, targetFolderId) => {
    try {
      await api.patch(`/api/mail/messages/${id}`, { folderId: targetFolderId });
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id),
        selectedMessage:
          state.selectedMessage?.id === id ? null : state.selectedMessage,
      }));
    } catch {
      // Error
    }
  },

  bulkAction: async (action, messageIds, targetFolderId) => {
    try {
      await api.post("/api/mail/messages/bulk", {
        messageIds,
        action,
        targetFolderId,
      });
      await get().fetchMessages(get().page);
    } catch {
      // Error
    }
  },

  triggerSync: async (accountId) => {
    const targetId = accountId || get().activeAccountId;
    if (!targetId && get().accounts.length > 0) {
      // Sync all accounts
      set({ isSyncing: true });
      for (const acc of get().accounts) {
        await api.post(`/api/mail/accounts/${acc.id}/sync`).catch(() => {});
      }
      setTimeout(() => {
        set({ isSyncing: false });
        get().fetchAccounts();
        get().fetchMessages(1);
      }, 2500);
      return;
    }

    if (!targetId) return;
    set({ isSyncing: true });
    try {
      await api.post(`/api/mail/accounts/${targetId}/sync`);
      setTimeout(() => {
        set({ isSyncing: false });
        get().fetchAccounts();
        get().fetchMessages(1);
      }, 2500);
    } catch {
      set({ isSyncing: false });
    }
  },

  openCompose: (initialData) => {
    set({ showComposeModal: true, composeDraft: initialData || null });
  },

  closeCompose: () => {
    set({ showComposeModal: false, composeDraft: null });
  },

  openAddAccount: () => set({ showAddAccountModal: true }),
  closeAddAccount: () => set({ showAddAccountModal: false }),
}));
