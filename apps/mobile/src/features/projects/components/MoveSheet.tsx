import { Pressable, View } from 'react-native';
import { Check } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useProjectStore } from '../store';

// ponytail: tap-to-move instead of drag-and-drop (appends to the target column); add a reorder gesture if needed.
export function MoveSheet({
  visible,
  currentColumnId,
  onClose,
  onPick,
}: {
  visible: boolean;
  currentColumnId?: string;
  onClose: () => void;
  onPick: (columnId: string) => void;
}) {
  const { colors } = useTheme();
  const columns = useProjectStore(s => s.current?.columns ?? []);
  return (
    <Sheet visible={visible} title="Move to…" onClose={onClose}>
      <View className="overflow-hidden rounded-xl border border-border">
        {columns.map((c, i) => (
          <Pressable
            key={c.id}
            disabled={c.id === currentColumnId}
            onPress={() => onPick(c.id)}
            className={cn('min-h-[52px] flex-row items-center gap-3 px-3 active:bg-muted', i > 0 && 'border-t border-border')}
            accessibilityState={{ selected: c.id === currentColumnId }}
          >
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color || colors.subtle }} />
            <Text className="flex-1 font-bold">{c.name}</Text>
            {c.id === currentColumnId && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
