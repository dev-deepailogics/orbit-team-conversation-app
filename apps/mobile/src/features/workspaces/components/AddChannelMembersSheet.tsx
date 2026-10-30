import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Check } from '@/components/icons';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { addChannelMembers } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';
import { useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  channel: Channel;
  onClose: () => void;
}

// Lists workspace members not yet in the channel; the server enforces workspace membership.
export function AddChannelMembersSheet({ visible, channel, onClose }: Props) {
  const { colors } = useTheme();
  const members = useWorkspaceStore(s => s.current?.members ?? []);
  const upsertChannel = useWorkspaceStore(s => s.upsertChannel);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inChannel = new Set((channel.members ?? []).map(m => m.userId));
  const candidates = members.filter(m => !inChannel.has(m.userId));

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = async () => {
    if (isLoading || !selected.length) return;
    setError('');
    setIsLoading(true);
    try {
      upsertChannel(await addChannelMembers(channel.id, selected));
      setSelected([]);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add people'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet visible={visible} title={`Add people to ${channel.name}`} onClose={onClose}>
      {candidates.length === 0 ? (
        <Text className="text-muted-foreground">Everyone in this workspace is already in the channel.</Text>
      ) : (
        <ScrollView className="max-h-72" contentContainerClassName="gap-1">
          {candidates.map(m => {
            const on = selected.includes(m.userId);
            return (
              <Pressable
                key={m.userId}
                onPress={() => toggle(m.userId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={cn('min-h-[52px] flex-row items-center gap-3 rounded-lg px-2 active:bg-muted', on && 'bg-accent')}
              >
                <Avatar name={m.user?.displayName ?? '?'} />
                <Text className="flex-1 font-bold" numberOfLines={1}>
                  {m.user?.displayName ?? m.userId}
                  {!!m.user?.username && <Text className="font-normal text-muted-foreground">  @{m.user.username}</Text>}
                </Text>
                <View className={cn('h-5 w-5 items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-input')}>
                  {on && <Check size={14} color={colors.primaryForeground} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!!error && <Text className="text-sm text-destructive">{error}</Text>}
      <Button disabled={isLoading || !selected.length} onPress={submit}>
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text>{selected.length ? `Add ${selected.length}` : 'Select people'}</Text>
        )}
      </Button>
    </Sheet>
  );
}
