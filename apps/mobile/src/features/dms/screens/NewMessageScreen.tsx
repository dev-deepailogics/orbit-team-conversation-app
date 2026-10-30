import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Search } from '@/components/icons';
import type { WorkspaceMember } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { openDirectMessage } from '@/features/workspaces/services/workspaceApi';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { ScreenProps } from '@/navigation/types';

export function NewMessageScreen({ navigation }: ScreenProps<'NewMessage'>) {
  const { colors } = useTheme();
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
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-4 py-3">
        <Input
          className="h-10 border-0 bg-muted pl-10"
          placeholder="To: search people"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <View className="absolute left-7 top-6" pointerEvents="none">
          <Search size={17} color={colors.subtle} />
        </View>
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
              className="min-h-[56px] flex-row items-center gap-3 px-4 py-2 active:bg-muted"
              accessibilityRole="button"
            >
              <Avatar name={name} />
              <View className="flex-1">
                <Text className="font-bold" numberOfLines={1}>
                  {name}
                  {item.userId === myId ? ' (you)' : ''}
                </Text>
                <Text className="text-sm text-muted-foreground">@{item.user?.username}</Text>
              </View>
              {openingId === item.userId && <ActivityIndicator color={colors.mutedForeground} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text className="py-12 text-center text-muted-foreground">No one matches “{query}”.</Text>}
      />
    </View>
  );
}
