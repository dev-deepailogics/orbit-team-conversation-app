import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ChevronDown, Plus, SquarePen } from '@/components/icons';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CreateChannelSheet } from '../components/CreateChannelSheet';
import { CreateWorkspaceSheet } from '@/features/admin/components/CreateWorkspaceSheet';
import { useAuthStore } from '@/features/auth/store';
import { useTheme } from '@/lib/theme';
import type { TabScreenProps } from '@/navigation/types';
import { ChannelRow } from '../components/ChannelRow';
import { JoinWorkspaceForm } from '../components/JoinWorkspaceForm';
import { WorkspaceSwitcherSheet } from '../components/WorkspaceSwitcherSheet';
import { useWorkspaceStore } from '../store';
import { splitChannels } from '../utils';

type Row =
  | { kind: 'header'; title: string; onAdd?: () => void }
  | { kind: 'channel'; channel: Channel };

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { colors } = useTheme();
  const myId = useAuthStore(s => s.user?.id);
  const canCreateWorkspace = useAuthStore(
    s =>
      s.user?.systemRole === 'SUPER_ADMIN' ||
      s.user?.systemRole === 'WORKSPACE_ADMIN',
  );
  const current = useWorkspaceStore(s => s.current);
  const unread = useWorkspaceStore(s => s.unread);
  const isLoading = useWorkspaceStore(s => s.isLoading);
  const error = useWorkspaceStore(s => s.error);
  const load = useWorkspaceStore(s => s.load);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  // Local, not the store's isLoading: background refetches (e.g. after adding a member while Home is off-screen)
  // toggle that flag, and iOS RefreshControl can miss the true→false change and spin forever.
  const [refreshing, setRefreshing] = useState(false);

  // The brand header is dark in both schemes; App's StatusBar takes over again once Home loses focus.
  const isFocused = useIsFocused();

  const rows = useMemo<Row[]>(() => {
    const { channels, dms } = splitChannels(current?.channels ?? [], myId);
    return [
      {
        kind: 'header',
        title: 'Channels',
        onAdd: () => setShowCreateChannel(true),
      },
      ...channels.map(channel => ({ kind: 'channel' as const, channel })),
      {
        kind: 'header',
        title: 'Direct messages',
        onAdd: () => navigation.navigate('NewMessage'),
      },
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
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      );
    }
    if (error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
          <Text className="text-center text-muted-foreground">{error}</Text>
          <Button variant="outline" onPress={() => load()}>
            <Text>Retry</Text>
          </Button>
        </View>
      );
    }
    // Same empty state as web: workspaces are private, so you need an invite (or admin rights to create one).
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-6 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="text-center text-2xl font-black">
              You're not in a workspace yet
            </Text>
            <Text className="text-center text-muted-foreground">
              Ask your workspace admin for an invite link, or to add you by
              email.
            </Text>
          </View>
          <JoinWorkspaceForm />
          {canCreateWorkspace && (
            <Button variant="outline" onPress={() => setShowCreate(true)}>
              <Text>Create a workspace</Text>
            </Button>
          )}
        </ScrollView>
        {createSheet}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand" edges={['top']}>
      {isFocused && <StatusBar barStyle="light-content" />}
      <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
        <Pressable
          onPress={() => setShowSwitcher(true)}
          className="flex-1 flex-row items-center gap-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`Workspace ${current.name}. Switch workspace`}
        >
          <Avatar
            name={current.name}
            className="h-9 w-9 rounded-xl border-2 border-brand-foreground/20"
          />
          <Text
            className="shrink text-xl font-black text-brand-foreground"
            numberOfLines={1}
          >
            {current.name}
          </Text>
          <ChevronDown size={18} color={colors.brandForeground} strokeWidth={2.5} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('NewMessage')}
          hitSlop={6}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-foreground/15 active:bg-brand-foreground/25"
          accessibilityRole="button"
          accessibilityLabel="New message"
        >
          <SquarePen size={18} color={colors.brandForeground} />
        </Pressable>
      </View>

      <View className="flex-1 overflow-hidden rounded-t-2xl bg-background">
        {!!error && (
          <Text className="px-4 pt-3 text-sm text-destructive">{error}</Text>
        )}

        <FlashList
          data={rows}
          getItemType={r => r.kind}
          keyExtractor={r => (r.kind === 'header' ? r.title : r.channel.id)}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load();
            } finally {
              setRefreshing(false);
            }
          }}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View className="mt-3 flex-row items-center justify-between pl-4 pr-2 pt-2">
                <Text className="font-bold">{item.title}</Text>
                {item.onAdd && (
                  <Pressable
                    onPress={item.onAdd}
                    hitSlop={6}
                    className="h-9 w-9 items-center justify-center rounded-lg active:bg-muted"
                    accessibilityLabel={`Add ${item.title}`}
                  >
                    <Plus size={20} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            ) : (
              <ChannelRow
                channel={item.channel}
                myId={myId}
                unread={unread[item.channel.id] ?? 0}
                onPress={() =>
                  navigation.navigate('Channel', { channelId: item.channel.id })
                }
              />
            )
          }
        />
      </View>

      <CreateChannelSheet
        visible={showCreateChannel}
        workspaceId={current.id}
        onClose={() => setShowCreateChannel(false)}
        onCreated={c => {
          setShowCreateChannel(false);
          navigation.navigate('Channel', { channelId: c.id });
        }}
      />
      <WorkspaceSwitcherSheet
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
      />
      {createSheet}
    </SafeAreaView>
  );
}
