import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '../store';
import { JoinWorkspaceForm } from './JoinWorkspaceForm';

export function WorkspaceSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const currentId = useWorkspaceStore(s => s.current?.id);
  const select = useWorkspaceStore(s => s.select);

  return (
    <Sheet visible={visible} title="Workspaces" onClose={onClose}>
      <View className="overflow-hidden rounded-lg border border-slack-darkBorder">
        {workspaces.map((w, i) => (
          <Pressable
            key={w.id}
            onPress={() => {
              onClose();
              if (w.id !== currentId) select(w.id);
            }}
            className={cn(
              'min-h-[52px] flex-row items-center gap-3 px-3 active:bg-white/5',
              i > 0 && 'border-t border-slack-darkBorder',
            )}
            accessibilityRole="button"
            accessibilityState={{ selected: w.id === currentId }}
          >
            <Avatar name={w.name} className="bg-slack-activeChannel" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                {w.name}
              </Text>
              <Text className="text-xs text-gray-400">/{w.slug}</Text>
            </View>
            {w.id === currentId && <Text className="text-slack-green">✓</Text>}
          </Pressable>
        ))}
      </View>
      <JoinWorkspaceForm onJoined={onClose} />
    </Sheet>
  );
}
