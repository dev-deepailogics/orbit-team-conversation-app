import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ChevronLeft } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  // Trailing icon buttons (e.g. add people, edit, more).
  right?: ReactNode;
}

// Custom header (native one is hidden) so KeyboardAvoidingView needs no header-height offset.
export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const { colors } = useTheme();
  return (
    <View className="min-h-[52px] flex-row items-center gap-1 border-b border-border bg-background px-1.5">
      <Button variant="ghost" size="icon" onPress={onBack} hitSlop={4} accessibilityLabel="Back">
        <ChevronLeft size={26} color={colors.foreground} strokeWidth={2} />
      </Button>
      <View className="flex-1 py-1.5">
        <Text className="text-lg font-bold" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View className="flex-row items-center pr-1">{right}</View>}
    </View>
  );
}
