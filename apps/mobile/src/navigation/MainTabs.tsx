import { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from '@/components/ui/text';
import { useChatStore } from '@/features/chat/store';
import { useRealtime } from '@/features/chat/hooks/useRealtime';
import { DMsScreen } from '@/features/dms/screens/DMsScreen';
import { ProjectsScreen } from '@/features/projects/screens/ProjectsScreen';
import { useProjectStore } from '@/features/projects/store';
import { YouScreen } from '@/features/profile/screens/YouScreen';
import { HomeScreen } from '@/features/workspaces/screens/HomeScreen';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { isDirect } from '@/features/workspaces/utils';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// ponytail: emoji tab icons until an icon set is added (react-native-svg is native, needs a pod install).
const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text className={focused ? 'text-xl' : 'text-xl opacity-50'}>{glyph}</Text>
);

// Signed-in shell: owns the session-scoped data (workspace, socket) so sign-out tears it all down.
export function MainTabs() {
  const load = useWorkspaceStore(s => s.load);
  const dmUnread = useWorkspaceStore(s =>
    (s.current?.channels ?? []).filter(isDirect).reduce((n, c) => n + (s.unread[c.id] ?? 0), 0),
  );

  useRealtime();

  useEffect(() => {
    load();
    return () => {
      useWorkspaceStore.getState().reset();
      useChatStore.getState().reset();
      useProjectStore.getState().reset();
    };
  }, [load]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#19171D', borderTopColor: '#383F45' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: icon('🏠') }} />
      <Tab.Screen
        name="DMs"
        component={DMsScreen}
        options={{ tabBarIcon: icon('💬'), tabBarBadge: dmUnread || undefined }}
      />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ tabBarIcon: icon('📋') }} />
      <Tab.Screen name="You" component={YouScreen} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}
