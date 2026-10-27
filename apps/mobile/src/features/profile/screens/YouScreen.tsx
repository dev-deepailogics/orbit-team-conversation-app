import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CreateWorkspaceSheet } from '@/features/admin/components/CreateWorkspaceSheet';
import { ROLE_LABELS } from '@/features/admin/utils';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import type { TabScreenProps } from '@/navigation/types';

// Slack's "You" tab. Admin entry points mirror the web home empty state (apps/web/src/app/page.tsx).
// ponytail: status / profile editing waits on a PATCH /api/auth/me endpoint (Phase 3).
export function YouScreen({ navigation }: TabScreenProps<'You'>) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loadWorkspaces = useWorkspaceStore((s) => s.load);
  const [showCreate, setShowCreate] = useState(false);

  if (!user) return null;
  const isSuperAdmin = user.systemRole === 'SUPER_ADMIN';
  const canCreateWorkspace = isSuperAdmin || user.systemRole === 'WORKSPACE_ADMIN';

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 p-6">
        <View className="flex-row items-center gap-4">
          <Avatar name={user.displayName} className="h-16 w-16 rounded-xl" />
          <View className="flex-1">
            <Text className="text-xl font-bold text-white" numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text className="text-sm text-gray-400" numberOfLines={1}>
              @{user.username} · {user.email}
            </Text>
            {user.systemRole !== 'USER' && (
              <Text className="mt-1 text-xs font-semibold text-purple-300">{ROLE_LABELS[user.systemRole]}</Text>
            )}
          </View>
        </View>

        {canCreateWorkspace && (
          <View className="gap-3">
            <Text className="text-sm text-gray-400">
              {isSuperAdmin
                ? 'You are a Super Administrator. Manage users and roles, reset passwords, or launch workspaces.'
                : 'You are a Company Administrator. Create your organization workspace to start inviting your team.'}
            </Text>
            {isSuperAdmin && (
              <Button className="h-11 bg-slack-accent" onPress={() => navigation.navigate('AdminConsole')}>
                <Text className="font-semibold text-white">Admin Console</Text>
              </Button>
            )}
            <Button className="h-11 bg-slack-green" onPress={() => setShowCreate(true)}>
              <Text className="font-semibold text-white">Create workspace</Text>
            </Button>
          </View>
        )}

        <Button variant="destructive" className="h-11" onPress={logout}>
          <Text>Sign out</Text>
        </Button>
      </ScrollView>

      {canCreateWorkspace && (
        <CreateWorkspaceSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(ws) => {
            setShowCreate(false);
            loadWorkspaces(ws.id);
            navigation.navigate('Home');
          }}
        />
      )}
    </SafeAreaView>
  );
}
