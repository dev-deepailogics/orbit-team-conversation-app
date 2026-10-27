import { Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
}

// Selectable pill used for filters, priorities, assignees and column tabs.
export function Chip({ label, selected, color, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={selected && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        'min-h-[36px] justify-center rounded-full border border-slack-darkBorder px-3 active:opacity-70',
        selected && !color && 'border-slack-activeChannel bg-slack-activeChannel',
      )}
    >
      <Text className={cn('text-sm', selected ? 'font-semibold text-white' : 'text-gray-300')} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
