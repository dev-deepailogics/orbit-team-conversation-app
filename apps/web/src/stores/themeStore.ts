import { create } from 'zustand';
import { ThemeConfig } from '@orbit/types';
import { DEFAULT_THEME, applyTheme, saveThemeLocally, getSavedTheme } from '../lib/theme';
import { api } from '../lib/api';

interface ThemeState {
  currentTheme: ThemeConfig;
  isLoading: boolean;
  setTheme: (theme: ThemeConfig, workspaceId?: string, saveToDb?: boolean, setAsWorkspaceDefault?: boolean) => Promise<void>;
  initTheme: (workspaceId?: string) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  currentTheme: DEFAULT_THEME,
  isLoading: false,

  setTheme: async (theme: ThemeConfig, workspaceId?: string, saveToDb = false, setAsWorkspaceDefault = false) => {
    // 1. Apply immediately in memory and in DOM for instant response
    set({ currentTheme: theme });
    applyTheme(theme);
    saveThemeLocally(theme, workspaceId);

    // 2. Persist to DB if requested and workspaceId is provided
    if (saveToDb && workspaceId) {
      try {
        await api.patch(`/api/workspaces/${workspaceId}/theme`, {
          theme,
          setAsWorkspaceDefault,
        });
      } catch (err) {
        console.error('Failed to save theme to database', err);
      }
    }
  },

  initTheme: async (workspaceId?: string) => {
    // 1. Fast path: load from localStorage synchronously
    const local = getSavedTheme(workspaceId);
    set({ currentTheme: local });
    applyTheme(local);

    // 2. Background path: fetch from DB if workspaceId provided
    if (workspaceId) {
      try {
        const res = await api.get(`/api/workspaces/${workspaceId}/theme`);
        if (res.data?.theme) {
          const serverTheme: ThemeConfig = res.data.theme;
          set({ currentTheme: serverTheme });
          applyTheme(serverTheme);
          saveThemeLocally(serverTheme, workspaceId);
        }
      } catch (err) {
        // Fallback to local theme silently
      }
    }
  },
}));
