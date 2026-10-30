import { Pressable, View } from 'react-native';
import { Check } from '@/components/icons';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '../store';
import { JoinWorkspaceForm } from './JoinWorkspaceForm';

export function WorkspaceSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const currentId = useWorkspaceStore(s => s.current?.id);
  const select = useWorkspaceStore(s => s.select);

  return (
    <Sheet visible={visible} title="Workspaces" onClose={onClose}>
      <View className="overflow-hidden rounded-xl border border-border">
        {workspaces.map((w, i) => (
          <Pressable
            key={w.id}
            onPress={() => {
              onClose();
              if (w.id !== currentId) select(w.id);
            }}
            className={cn(
              'min-h-[60px] flex-row items-center gap-3 px-3 active:bg-muted',
              i > 0 && 'border-t border-border',
            )}
            accessibilityRole="button"
            accessibilityState={{ selected: w.id === currentId }}
          >
            <Avatar name={w.name} className="h-10 w-10 rounded-xl" />
            <View className="flex-1">
              <Text className="font-bold" numberOfLines={1}>
                {w.name}
              </Text>
              <Text className="text-sm text-muted-foreground">/{w.slug}</Text>
            </View>
            {w.id === currentId && <Check size={20} color={colors.primary} strokeWidth={2.5} />}
          </Pressable>
        ))}
      </View>
      <JoinWorkspaceForm onJoined={onClose} />
    </Sheet>
  );
}
