import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { useSettingsStore } from '@/features/settings/store';
import { hexToChannels, palettes, toCssVars } from '@/lib/theme';

test('palettes define the same tokens and become rgb channel variables', () => {
  expect(Object.keys(palettes.dark)).toEqual(Object.keys(palettes.light));
  expect(hexToChannels('#1D6FE0')).toBe('29 111 224');
  expect(hexToChannels('#FFFFFF')).toBe('255 255 255');
  expect(toCssVars(palettes.light)['--muted-foreground']).toBe(hexToChannels(palettes.light.mutedForeground));
});

describe('theme preference', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem('orbit_theme');
    useSettingsStore.setState({ theme: 'system' });
  });

  test('setTheme saves the choice and applies it', async () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(colorScheme.get()).toBe('dark');
    expect(await AsyncStorage.getItem('orbit_theme')).toBe('dark');
  });

  test('hydrate restores a saved choice and ignores junk', async () => {
    await AsyncStorage.setItem('orbit_theme', 'light');
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().theme).toBe('light');

    useSettingsStore.setState({ theme: 'system' });
    await AsyncStorage.setItem('orbit_theme', 'purple');
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().theme).toBe('system');
  });
});
