import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  // Optional trailing text button (e.g. "Add").
  action?: { label: string; onPress: () => void };
}

// Custom header (native one is hidden) so KeyboardAvoidingView needs no header-height offset.
export function ChatHeader({ title, subtitle, onBack, action }: Props) {
  return (
    <View className="flex-row items-center gap-1 border-b border-slack-darkBorder px-2 py-2">
      <Pressable
        onPress={onBack}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text className="text-3xl leading-8 text-white">‹</Text>
      </Pressable>
      <View className="flex-1">
        <Text className="text-base font-bold text-white" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text className="text-xs text-gray-400" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} className="px-3 py-2" accessibilityRole="button">
          <Text className="text-sm font-semibold text-slack-green">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
