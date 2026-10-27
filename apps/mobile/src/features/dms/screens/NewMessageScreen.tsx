import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { WorkspaceMember } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { openDirectMessage } from '@/features/workspaces/services/workspaceApi';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { getErrorMessage } from '@/lib/api';
import type { ScreenProps } from '@/navigation/types';

export function NewMessageScreen({ navigation }: ScreenProps<'NewMessage'>) {
  const myId = useAuthStore(s => s.user?.id);
  const workspaceId = useWorkspaceStore(s => s.current?.id);
  const members = useWorkspaceStore(s => s.current?.members);
  const upsertChannel = useWorkspaceStore(s => s.upsertChannel);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members ?? [])
      .filter(m => !q || [m.user?.displayName, m.user?.username].some(f => f?.toLowerCase().includes(q)))
      // You first (notes to self, like Slack), then alphabetical.
      .sort((a, b) =>
        a.userId === myId ? -1 : b.userId === myId ? 1 : (a.user?.displayName ?? '').localeCompare(b.user?.displayName ?? ''),
      );
  }, [members, query, myId]);

  const open = async (member: WorkspaceMember) => {
    if (openingId || !workspaceId) return;
    setOpeningId(member.userId);
    try {
      const channel = await openDirectMessage(workspaceId, member.userId);
      upsertChannel(channel);
      navigation.replace('Channel', { channelId: channel.id });
    } catch (err) {
      Alert.alert('Could not open conversation', getErrorMessage(err, 'Please try again.'));
      setOpeningId(null);
    }
  };

  return (
    <View className="flex-1 bg-slack-darkBg">
      <View className="border-b border-slack-darkBorder p-4">
        <Input
          className="h-10 border-gray-700 bg-slack-darkSidebar text-white"
          placeholder="To: search people"
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlashList
        data={filtered}
        keyExtractor={m => m.userId}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const name = item.user?.displayName || item.user?.username || 'Unknown';
          return (
            <Pressable
              onPress={() => open(item)}
              disabled={!!openingId}
              className="min-h-[52px] flex-row items-center gap-3 px-4 py-2 active:bg-white/5"
              accessibilityRole="button"
            >
              <Avatar name={name} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                  {name}
                  {item.userId === myId ? ' (you)' : ''}
                </Text>
                <Text className="text-xs text-gray-400">@{item.user?.username}</Text>
              </View>
              {openingId === item.userId && <ActivityIndicator color="white" />}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text className="py-12 text-center text-sm text-gray-500">No one matches “{query}”.</Text>}
      />
    </View>
  );
}
