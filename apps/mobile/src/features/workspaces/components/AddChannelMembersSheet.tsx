import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { addChannelMembers } from '../services/workspaceApi';
import { useWorkspaceStore } from '../store';

interface Props {
  visible: boolean;
  channel: Channel;
  onClose: () => void;
}

// Lists workspace members not yet in the channel; the server enforces workspace membership.
export function AddChannelMembersSheet({ visible, channel, onClose }: Props) {
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
        <Text className="text-sm text-gray-400">Everyone in this workspace is already in the channel.</Text>
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
                className={cn('flex-row items-center gap-3 rounded-lg px-2 py-2', on && 'bg-slack-green/15')}
              >
                <Avatar name={m.user?.displayName ?? '?'} className="h-9 w-9 rounded-lg" />
                <Text className="flex-1 text-sm text-white" numberOfLines={1}>
                  {m.user?.displayName ?? m.userId}
                  {!!m.user?.username && <Text className="text-gray-400">  @{m.user.username}</Text>}
                </Text>
                {on && <Text className="text-slack-green">✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!!error && <Text className="text-xs text-red-400">{error}</Text>}
      <Button className="h-11 bg-slack-green" disabled={isLoading || !selected.length} onPress={submit}>
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="font-semibold text-white">{selected.length ? `Add ${selected.length}` : 'Select people'}</Text>
        )}
      </Button>
    </Sheet>
  );
}
