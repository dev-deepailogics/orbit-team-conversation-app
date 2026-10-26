import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CreateWorkspaceSheet } from '../components/CreateWorkspaceSheet';
import { UserActionsSheet } from '../components/UserActionsSheet';
import { deleteWorkspace } from '../services/adminApi';
import { useAdminStore } from '../store';
import type {
  AdminStats,
  AdminUser,
  AdminWorkspace,
  RoleFilter,
} from '../types';
import { filterUsers, filterWorkspaces, ROLES, ROLE_LABELS } from '../utils';

type Tab = 'users' | 'workspaces';

const ROLE_FILTERS: RoleFilter[] = ['ALL', ...ROLES];

// Mobile port of apps/web/src/app/admin/page.tsx. Registered only for SUPER_ADMIN (App.tsx); the server enforces it too.
export function AdminConsoleScreen() {
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore(s => s.user?.id);
  const stats = useAdminStore(s => s.stats);
  const users = useAdminStore(s => s.users);
  const workspaces = useAdminStore(s => s.workspaces);
  const isLoading = useAdminStore(s => s.isLoading);
  const error = useAdminStore(s => s.error);
  const load = useAdminStore(s => s.load);

  const [tab, setTab] = useState<Tab>('users');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  // Look the user up by id so the sheet shows fresh data after a refetch (and closes if they were deleted).
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(
    () => filterUsers(users, query, roleFilter),
    [users, query, roleFilter],
  );
  const filteredWorkspaces = useMemo(
    () => filterWorkspaces(workspaces, query),
    [workspaces, query],
  );
  const selectedUser = users.find(u => u.id === selectedUserId) ?? null;

  const switchTab = (next: Tab) => {
    setTab(next);
    setQuery('');
  };

  const confirmDeleteWorkspace = (ws: AdminWorkspace) => {
    if (deletingId) return;
    Alert.alert(
      `Delete ${ws.name}?`,
      'This permanently deletes the workspace with all its channels, messages and files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(ws.id);
            try {
              await deleteWorkspace(ws.id);
              await load();
            } catch (err) {
              Alert.alert(
                'Delete failed',
                getErrorMessage(err, 'Failed to delete workspace'),
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  // First load: nothing to show yet.
  if (!stats) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
        {isLoading || !error ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text className="text-center text-gray-300">{error}</Text>
            <Button className="bg-slack-activeChannel" onPress={load}>
              <Text className="text-white">Retry</Text>
            </Button>
          </>
        )}
      </View>
    );
  }

  const listProps = {
    refreshing: isLoading,
    onRefresh: load,
    keyboardShouldPersistTaps: 'handled' as const,
    contentContainerStyle: {
      paddingHorizontal: 16,
      paddingBottom: insets.bottom + 16,
    },
    ItemSeparatorComponent: Separator,
  };

  return (
    <View className="flex-1 bg-slack-darkBg">
      <StatsRow stats={stats} />

      <View className="mx-4 flex-row border-b border-slack-darkBorder">
        <TabButton
          label={`Users (${users.length})`}
          active={tab === 'users'}
          onPress={() => switchTab('users')}
        />
        <TabButton
          label={`Workspaces (${workspaces.length})`}
          active={tab === 'workspaces'}
          onPress={() => switchTab('workspaces')}
        />
      </View>

      <View className="gap-3 p-4">
        <Input
          className="h-10 border-gray-700 bg-slack-darkSidebar text-white"
          placeholder={
            tab === 'users'
              ? 'Search name, username or email'
              : 'Search name, slug or owner'
          }
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {tab === 'users' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {ROLE_FILTERS.map(r => (
              <Pressable
                key={r}
                onPress={() => setRoleFilter(r)}
                hitSlop={6}
                className={cn(
                  'rounded-full border px-3 py-1.5',
                  roleFilter === r
                    ? 'border-slack-activeChannel bg-slack-activeChannel/20'
                    : 'border-gray-700',
                )}
                accessibilityRole="button"
                accessibilityState={{ selected: roleFilter === r }}
              >
                <Text
                  className={cn(
                    'text-xs',
                    roleFilter === r
                      ? 'font-semibold text-white'
                      : 'text-gray-400',
                  )}
                >
                  {r === 'ALL' ? 'All' : ROLE_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Button
            className="h-10 bg-slack-green"
            onPress={() => setShowCreate(true)}
          >
            <Text className="font-semibold text-white">+ New workspace</Text>
          </Button>
        )}
        {!!error && <Text className="text-xs text-red-400">{error}</Text>}
      </View>

      {tab === 'users' ? (
        <FlashList
          {...listProps}
          data={filteredUsers}
          keyExtractor={u => u.id}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              isSelf={item.id === currentUserId}
              onPress={() => setSelectedUserId(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              text={
                users.length ? 'No users match your filters.' : 'No users yet.'
              }
            />
          }
        />
      ) : (
        <FlashList
          {...listProps}
          data={filteredWorkspaces}
          keyExtractor={w => w.id}
          renderItem={({ item }) => (
            <WorkspaceRow
              workspace={item}
              isDeleting={deletingId === item.id}
              onDelete={() => confirmDeleteWorkspace(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              text={
                workspaces.length
                  ? 'No workspaces match your search.'
                  : 'No workspaces yet.'
              }
            />
          }
        />
      )}

      <UserActionsSheet
        user={selectedUser}
        isSelf={selectedUser?.id === currentUserId}
        onClose={() => setSelectedUserId(null)}
        onChanged={load}
      />
      <CreateWorkspaceSheet
        visible={showCreate}
        withOwner
        onClose={() => setShowCreate(false)}
        onCreated={ws => {
          setShowCreate(false);
          load();
          Alert.alert('Workspace created', `"${ws.name}" is ready.`);
        }}
      />
    </View>
  );
}

function StatsRow({ stats }: { stats: AdminStats }) {
  const tiles = [
    {
      label: 'Users',
      value: stats.totalUsers,
      hint: `${stats.onlineUsers} online`,
    },
    { label: 'Workspaces', value: stats.totalWorkspaces },
    { label: 'Channels', value: stats.totalChannels },
    { label: 'Messages', value: stats.totalMessages },
    {
      label: 'Storage',
      value: stats.formattedStorage,
      hint: `${stats.totalAttachments} files`,
    },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-3 px-4 py-4"
    >
      {tiles.map(t => (
        <View
          key={t.label}
          className="min-w-[104px] rounded-xl border border-slack-darkBorder bg-slack-darkSidebar p-3"
        >
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {t.label}
          </Text>
          <Text className="mt-1 text-xl font-bold text-white">
            {t.value.toLocaleString()}
          </Text>
          {!!t.hint && (
            <Text className="text-[11px] text-gray-500">{t.hint}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'min-h-[44px] flex-1 items-center justify-center border-b-2',
        active ? 'border-slack-green' : 'border-transparent',
      )}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={cn(
          'text-sm',
          active ? 'font-bold text-white' : 'text-gray-400',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function UserRow({
  user,
  isSelf,
  onPress,
}: {
  user: AdminUser;
  isSelf: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[56px] flex-row items-center gap-3 py-2.5 active:opacity-70"
    >
      <Avatar name={user.displayName || user.username} className="h-10 w-10" />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="shrink text-sm font-semibold text-white"
            numberOfLines={1}
          >
            {user.displayName}
            {isSelf ? ' (you)' : ''}
          </Text>
          {user.systemRole !== 'USER' && <RoleBadge role={user.systemRole} />}
        </View>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          @{user.username} · {user.email}
        </Text>
        <Text className="text-[11px] text-gray-500" numberOfLines={1}>
          {user._count.memberships === 1
            ? '1 workspace'
            : `${user._count.memberships} workspaces`}{' '}
          · {user._count.messages.toLocaleString()} messages
        </Text>
      </View>
      <Text className="text-lg text-gray-500">›</Text>
    </Pressable>
  );
}

function RoleBadge({ role }: { role: AdminUser['systemRole'] }) {
  return (
    <View
      className={cn(
        'rounded-full border px-1.5 py-0.5',
        role === 'SUPER_ADMIN'
          ? 'border-purple-500/40 bg-purple-500/20'
          : 'border-slack-green/40 bg-slack-green/20',
      )}
    >
      <Text
        className={cn(
          'text-[9px] font-bold uppercase',
          role === 'SUPER_ADMIN' ? 'text-purple-300' : 'text-green-300',
        )}
      >
        {ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

function WorkspaceRow({
  workspace,
  isDeleting,
  onDelete,
}: {
  workspace: AdminWorkspace;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 py-2.5">
      <Avatar
        name={workspace.name}
        className="h-10 w-10 bg-slack-activeChannel"
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-white" numberOfLines={1}>
          {workspace.name}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          /{workspace.slug} · Owner: {workspace.owner?.displayName ?? 'Unknown'}
        </Text>
        <Text className="text-[11px] text-gray-500">
          {workspace._count.members} members · {workspace._count.channels}{' '}
          channels
        </Text>
      </View>
      {isDeleting ? (
        <ActivityIndicator color="white" />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onPress={onDelete}
          hitSlop={8}
          accessibilityLabel={`Delete workspace ${workspace.name}`}
        >
          <Text className="text-xs font-semibold text-red-400">Delete</Text>
        </Button>
      )}
    </View>
  );
}

function Separator() {
  return <View className="h-px bg-slack-darkBorder/60" />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text className="py-12 text-center text-sm text-gray-500">{text}</Text>
  );
}
