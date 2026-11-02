import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { onSwatch } from '@/lib/theme';
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
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={selected && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 active:bg-muted',
        selected && !color && 'border-link bg-accent',
      )}
    >
      {!!color && !selected && <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <Text
        className={cn(
          'text-sm font-bold text-muted-foreground',
          selected && !color && 'text-accent-foreground',
        )}
        style={selected && color ? { color: onSwatch } : undefined}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
