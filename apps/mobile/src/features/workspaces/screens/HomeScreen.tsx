import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CreateWorkspaceSheet } from '@/features/admin/components/CreateWorkspaceSheet';
import { useAuthStore } from '@/features/auth/store';
import type { TabScreenProps } from '@/navigation/types';
import { ChannelRow } from '../components/ChannelRow';
import { JoinWorkspaceForm } from '../components/JoinWorkspaceForm';
import { WorkspaceSwitcherSheet } from '../components/WorkspaceSwitcherSheet';
import { useWorkspaceStore } from '../store';
import { splitChannels } from '../utils';

type Row = { kind: 'header'; title: string; onAdd?: () => void } | { kind: 'channel'; channel: Channel };

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const myId = useAuthStore(s => s.user?.id);
  const canCreateWorkspace = useAuthStore(s => s.user?.systemRole === 'SUPER_ADMIN' || s.user?.systemRole === 'WORKSPACE_ADMIN');
  const current = useWorkspaceStore(s => s.current);
  const unread = useWorkspaceStore(s => s.unread);
  const isLoading = useWorkspaceStore(s => s.isLoading);
  const error = useWorkspaceStore(s => s.error);
  const load = useWorkspaceStore(s => s.load);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const { channels, dms } = splitChannels(current?.channels ?? [], myId);
    return [
      { kind: 'header', title: 'Channels' },
      ...channels.map(channel => ({ kind: 'channel' as const, channel })),
      { kind: 'header', title: 'Direct messages', onAdd: () => navigation.navigate('NewMessage') },
      ...dms.map(channel => ({ kind: 'channel' as const, channel })),
    ];
  }, [current?.channels, myId, navigation]);

  const createSheet = canCreateWorkspace && (
    <CreateWorkspaceSheet
      visible={showCreate}
      onClose={() => setShowCreate(false)}
      onCreated={ws => {
        setShowCreate(false);
        load(ws.id);
      }}
    />
  );

  if (!current) {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center bg-slack-darkBg">
          <ActivityIndicator color="white" />
        </View>
      );
    }
    if (error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
          <Text className="text-center text-gray-300">{error}</Text>
          <Button className="bg-slack-activeChannel" onPress={() => load()}>
            <Text className="text-white">Retry</Text>
          </Button>
        </View>
      );
    }
    // Same empty state as web: workspaces are private, so you need an invite (or admin rights to create one).
    return (
      <SafeAreaView className="flex-1 bg-slack-darkBg">
        <ScrollView contentContainerClassName="flex-grow justify-center gap-6 p-6" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Text className="text-center text-2xl font-bold text-white">You're not in a workspace yet</Text>
            <Text className="text-center text-sm text-gray-400">
              Ask your workspace admin for an invite link, or to add you by email.
            </Text>
          </View>
          <JoinWorkspaceForm />
          {canCreateWorkspace && (
            <Button className="h-11 bg-slack-green" onPress={() => setShowCreate(true)}>
              <Text className="font-semibold text-white">Create a workspace</Text>
            </Button>
          )}
        </ScrollView>
        {createSheet}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top']}>
      <Pressable
        onPress={() => setShowSwitcher(true)}
        className="flex-row items-center gap-3 border-b border-slack-darkBorder px-4 py-3 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`Workspace ${current.name}. Switch workspace`}
      >
        <Avatar name={current.name} className="bg-slack-activeChannel" />
        <Text className="flex-1 text-lg font-bold text-white" numberOfLines={1}>
          {current.name}
        </Text>
        <Text className="text-gray-400">▾</Text>
      </Pressable>

      {!!error && <Text className="px-4 pt-2 text-xs text-red-400">{error}</Text>}

      <FlashList
        data={rows}
        getItemType={r => r.kind}
        keyExtractor={r => (r.kind === 'header' ? r.title : r.channel.id)}
        refreshing={isLoading}
        onRefresh={() => load()}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View className="mt-4 flex-row items-center justify-between px-4 pb-1">
              <Text className="text-sm font-semibold text-gray-400">{item.title}</Text>
              {item.onAdd && (
                <Pressable onPress={item.onAdd} hitSlop={12} accessibilityLabel="New message">
                  <Text className="text-xl text-gray-400">＋</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <ChannelRow
              channel={item.channel}
              myId={myId}
              unread={unread[item.channel.id] ?? 0}
              onPress={() => navigation.navigate('Channel', { channelId: item.channel.id })}
            />
          )
        }
      />

      <WorkspaceSwitcherSheet visible={showSwitcher} onClose={() => setShowSwitcher(false)} />
      {createSheet}
    </SafeAreaView>
  );
}
