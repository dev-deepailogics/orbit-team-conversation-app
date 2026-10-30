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

export const isThemePreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark';

interface SettingsState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
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

  hydrate: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (!isThemePreference(saved) || saved === 'system') return;
    colorScheme.set(saved);
    set({ theme: saved });
  },
}));
