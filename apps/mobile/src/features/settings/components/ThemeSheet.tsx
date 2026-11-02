import { Pressable, View } from 'react-native';
import { Check } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { THEME_OPTIONS, useSettingsStore } from '../store';

// Slack's Preferences → Dark mode picker.
export function ThemeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} title="Dark mode" onClose={onClose}>
      <View className="overflow-hidden rounded-xl border border-border">
        {THEME_OPTIONS.map((o, i) => (
          <Pressable
            key={o.value}
            onPress={() => setTheme(o.value)}
            className={cn('min-h-[60px] flex-row items-center gap-3 px-4 active:bg-muted', i > 0 && 'border-t border-border')}
            accessibilityRole="radio"
            accessibilityState={{ selected: theme === o.value }}
          >
            <View className="flex-1">
              <Text className="font-bold">{o.label}</Text>
              <Text className="text-sm text-muted-foreground">{o.hint}</Text>
            </View>
            {theme === o.value && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
