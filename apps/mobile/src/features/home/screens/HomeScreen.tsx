import { useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CreateWorkspaceSheet } from '@/features/admin/components/CreateWorkspaceSheet';
import { useAuthStore } from '@/features/auth/store';
import type { ScreenProps } from '@/navigation/types';

// Placeholder signed-in screen until the workspace/channel UI lands.
// Admin entry points mirror the web home empty state (apps/web/src/app/page.tsx).
export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showCreate, setShowCreate] = useState(false);

  const isSuperAdmin = user?.systemRole === 'SUPER_ADMIN';
  const canCreateWorkspace = isSuperAdmin || user?.systemRole === 'WORKSPACE_ADMIN';

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
      <View className="items-center gap-1">
        <Text className="text-xl font-bold text-white">Hi, {user?.displayName}</Text>
        <Text className="text-sm text-gray-400">@{user?.username} · {user?.email}</Text>
      </View>

      {canCreateWorkspace && (
        <View className="w-full gap-3">
          <Text className="text-center text-sm text-gray-400">
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

      <Button variant="destructive" onPress={logout}>
        <Text>Sign out</Text>
      </Button>

      {canCreateWorkspace && (
        <CreateWorkspaceSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(name) => {
            setShowCreate(false);
            // ponytail: no workspace UI on mobile yet; open it on web until the channels feature lands.
            Alert.alert('Workspace created', `"${name}" is ready. Open it on the web app to add channels and members.`);
          }}
        />
      )}
    </SafeAreaView>
  );
}
