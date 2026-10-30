import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight, Plus, Search, Trash2 } from '@/components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
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
  const { colors } = useTheme();
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
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        {isLoading || !error ? (
          <ActivityIndicator color={colors.mutedForeground} />
        ) : (
          <>
            <Text className="text-center text-muted-foreground">{error}</Text>
            <Button variant="outline" onPress={load}>
              <Text>Retry</Text>
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
    <View className="flex-1 bg-background">
      <StatsRow stats={stats} />

      <View className="flex-row border-b border-border px-4">
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
        <View className="justify-center">
          <Input
            className="h-10 border-0 bg-muted pl-10"
            placeholder={
              tab === 'users'
                ? 'Search name, username or email'
                : 'Search name, slug or owner'
            }
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <View className="absolute left-3 top-3" pointerEvents="none">
            <Search size={17} color={colors.subtle} />
          </View>
        </View>
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
                  'h-8 justify-center rounded-full border px-3',
                  roleFilter === r
                    ? 'border-link bg-accent'
                    : 'border-border',
                )}
                accessibilityRole="button"
                accessibilityState={{ selected: roleFilter === r }}
              >
                <Text
                  className={cn(
                    'text-sm font-bold',
                    roleFilter === r
                      ? 'text-accent-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {r === 'ALL' ? 'All' : ROLE_LABELS[r]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Button
            size="sm"
            className="self-start"
            onPress={() => setShowCreate(true)}
          >
            <Plus size={16} color={colors.primaryForeground} strokeWidth={2.5} />
            <Text>New workspace</Text>
          </Button>
        )}
        {!!error && <Text className="text-sm text-destructive">{error}</Text>}
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
          className="min-w-[112px] rounded-xl border border-border bg-background p-3"
        >
          <Text className="text-sm text-muted-foreground">{t.label}</Text>
          <Text className="mt-0.5 text-2xl font-black">
            {t.value.toLocaleString()}
          </Text>
          {!!t.hint && <Text className="text-xs text-subtle">{t.hint}</Text>}
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
        active ? 'border-foreground' : 'border-transparent',
      )}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={cn(
          'font-bold',
          active ? 'text-foreground' : 'text-muted-foreground',
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[64px] flex-row items-center gap-3 py-3 active:opacity-70"
    >
      <Avatar name={user.displayName || user.username} className="h-10 w-10" />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink font-bold" numberOfLines={1}>
            {user.displayName}
            {isSelf ? ' (you)' : ''}
          </Text>
          {user.systemRole !== 'USER' && <RoleBadge role={user.systemRole} />}
        </View>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          @{user.username} · {user.email}
        </Text>
        <Text className="text-xs text-subtle" numberOfLines={1}>
          {user._count.memberships === 1
            ? '1 workspace'
            : `${user._count.memberships} workspaces`}{' '}
          · {user._count.messages.toLocaleString()} messages
        </Text>
      </View>
      <ChevronRight size={18} color={colors.subtle} />
    </Pressable>
  );
}

function RoleBadge({ role }: { role: AdminUser['systemRole'] }) {
  return (
    <View
      className={cn(
        'rounded-md px-1.5 py-0.5',
        role === 'SUPER_ADMIN' ? 'bg-accent' : 'bg-muted',
      )}
    >
      <Text
        className={cn(
          'text-2xs font-bold',
          role === 'SUPER_ADMIN' ? 'text-accent-foreground' : 'text-muted-foreground',
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
  const { colors } = useTheme();
  return (
    <View className="min-h-[64px] flex-row items-center gap-3 py-3">
      <Avatar name={workspace.name} className="h-10 w-10 rounded-xl" />
      <View className="flex-1">
        <Text className="font-bold" numberOfLines={1}>
          {workspace.name}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          /{workspace.slug} · Owner: {workspace.owner?.displayName ?? 'Unknown'}
        </Text>
        <Text className="text-xs text-subtle">
          {workspace._count.members} members · {workspace._count.channels}{' '}
          channels
        </Text>
      </View>
      {isDeleting ? (
        <ActivityIndicator color={colors.mutedForeground} />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onPress={onDelete}
          accessibilityLabel={`Delete workspace ${workspace.name}`}
        >
          <Trash2 size={19} color={colors.destructive} />
        </Button>
      )}
    </View>
  );
}

function Separator() {
  return <View className="h-px bg-border" />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text className="py-12 text-center text-muted-foreground">{text}</Text>
  );
}
