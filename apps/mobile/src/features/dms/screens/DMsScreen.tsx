import { useMemo } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { ChannelRow } from '@/features/workspaces/components/ChannelRow';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { splitChannels } from '@/features/workspaces/utils';
import type { TabScreenProps } from '@/navigation/types';

const listStyle = { paddingTop: 8 };

export function DMsScreen({ navigation }: TabScreenProps<'DMs'>) {
  const myId = useAuthStore(s => s.user?.id);
  const channels = useWorkspaceStore(s => s.current?.channels);
  const unread = useWorkspaceStore(s => s.unread);
  const hasWorkspace = useWorkspaceStore(s => !!s.current);
  const dms = useMemo(() => splitChannels(channels ?? [], myId).dms, [channels, myId]);

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top']}>
      <View className="flex-row items-center justify-between border-b border-slack-darkBorder px-4 py-3">
        <Text className="text-lg font-bold text-white">Direct messages</Text>
        {hasWorkspace && (
          <Button size="sm" className="bg-slack-activeChannel" onPress={() => navigation.navigate('NewMessage')}>
            <Text className="font-semibold text-white">New</Text>
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
          <Text className="px-6 py-12 text-center text-sm text-gray-500">
            {hasWorkspace ? 'No conversations yet. Tap New to message a teammate.' : 'Join a workspace from Home to start messaging.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
