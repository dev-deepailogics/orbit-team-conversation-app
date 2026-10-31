import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: "Match your phone's appearance" },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

// A display preference, not a secret, so AsyncStorage (not the Keychain) is the right home.
const STORAGE_KEY = 'orbit_theme';
const COMPRESS_KEY = 'orbit_compress_uploads';

export const isThemePreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark';

interface SettingsState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  // Shrink photos when attaching them. On by default, like Slack.
  compressUploads: boolean;
  setCompressUploads: (on: boolean) => void;
  // Applies the saved choice on launch; until it resolves the app follows the system scheme.
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>(set => ({
  theme: 'system',

  setTheme: theme => {
    colorScheme.set(theme);
    set({ theme });
    // Losing the write only means the choice resets next launch; never block the UI on it.
    AsyncStorage.setItem(STORAGE_KEY, theme).catch(() => {});
  },

  compressUploads: true,

  setCompressUploads: on => {
    set({ compressUploads: on });
    AsyncStorage.setItem(COMPRESS_KEY, on ? '1' : '0').catch(() => {});
  },

  hydrate: async () => {
    const stored = await AsyncStorage.getMany([STORAGE_KEY, COMPRESS_KEY]).catch(() => ({}) as Record<string, string | null>);
    const saved = stored[STORAGE_KEY];
    if (stored[COMPRESS_KEY]) set({ compressUploads: stored[COMPRESS_KEY] === '1' });
    if (!isThemePreference(saved) || saved === 'system') return;
    colorScheme.set(saved);
    set({ theme: saved });
  },
}));
