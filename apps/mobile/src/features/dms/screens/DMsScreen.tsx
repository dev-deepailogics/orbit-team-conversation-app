import { useMemo } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SquarePen } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { ChannelRow } from '@/features/workspaces/components/ChannelRow';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { splitChannels } from '@/features/workspaces/utils';
import { useTheme } from '@/lib/theme';
import type { TabScreenProps } from '@/navigation/types';

const listStyle = { paddingTop: 4 };

export function DMsScreen({ navigation }: TabScreenProps<'DMs'>) {
  const { colors } = useTheme();
  const myId = useAuthStore(s => s.user?.id);
  const channels = useWorkspaceStore(s => s.current?.channels);
  const unread = useWorkspaceStore(s => s.unread);
  const hasWorkspace = useWorkspaceStore(s => !!s.current);
  const dms = useMemo(() => splitChannels(channels ?? [], myId).dms, [channels, myId]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="min-h-[56px] flex-row items-center justify-between border-b border-border pl-4 pr-2">
        <Text className="text-2xl font-black">Direct messages</Text>
        {hasWorkspace && (
          <Button variant="ghost" size="icon" onPress={() => navigation.navigate('NewMessage')} accessibilityLabel="New message">
            <SquarePen size={21} color={colors.foreground} />
          </Button>
        )}
      </View>
      <FlashList
        data={dms}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <ChannelRow
            channel={item}
            myId={myId}
            unread={unread[item.id] ?? 0}
            onPress={() => navigation.navigate('Channel', { channelId: item.id })}
          />
        )}
        contentContainerStyle={listStyle}
        ListEmptyComponent={
          <Text className="px-6 py-12 text-center text-muted-foreground">
            {hasWorkspace ? 'No conversations yet. Tap the compose button to message a teammate.' : 'Join a workspace from Home to start messaging.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
