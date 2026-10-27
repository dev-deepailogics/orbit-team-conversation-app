import { Pressable, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
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
  const columns = useProjectStore(s => s.current?.columns ?? []);
  return (
    <Sheet visible={visible} title="Move to…" onClose={onClose}>
      <View className="overflow-hidden rounded-lg border border-slack-darkBorder">
        {columns.map((c, i) => (
          <Pressable
            key={c.id}
            disabled={c.id === currentColumnId}
            onPress={() => onPick(c.id)}
            className={cn('min-h-[48px] flex-row items-center gap-3 px-3 active:bg-white/5', i > 0 && 'border-t border-slack-darkBorder')}
            accessibilityState={{ selected: c.id === currentColumnId }}
          >
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color || '#6B7280' }} />
            <Text className="flex-1 text-white">{c.name}</Text>
            {c.id === currentColumnId && <Text className="text-slack-green">✓</Text>}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
