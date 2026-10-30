import { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CircleUser, House, MessagesSquare, SquareKanban, type LucideIcon } from '@/components/icons';
import { useChatStore } from '@/features/chat/store';
import { useRealtime } from '@/features/chat/hooks/useRealtime';
import { DMsScreen } from '@/features/dms/screens/DMsScreen';
import { ProjectsScreen } from '@/features/projects/screens/ProjectsScreen';
import { useProjectStore } from '@/features/projects/store';
import { YouScreen } from '@/features/profile/screens/YouScreen';
import { HomeScreen } from '@/features/workspaces/screens/HomeScreen';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { isDirect } from '@/features/workspaces/utils';
import { FONT, useTheme } from '@/lib/theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// Slack's tab bar: line icons, heavier stroke on the active tab.
const icon =
  (Icon: LucideIcon) =>
  ({ focused, color }: { focused: boolean; color: string }) => <Icon size={24} color={color} strokeWidth={focused ? 2.25 : 1.75} />;

// Signed-in shell: owns the session-scoped data (workspace, socket) so sign-out tears it all down.
export function MainTabs() {
  const { colors } = useTheme();
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
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
        tabBarBadgeStyle: { backgroundColor: colors.destructive, color: colors.destructiveForeground, fontFamily: FONT, fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: icon(House) }} />
      <Tab.Screen
        name="DMs"
        component={DMsScreen}
        options={{ tabBarIcon: icon(MessagesSquare), tabBarBadge: dmUnread || undefined }}
      />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ tabBarIcon: icon(SquareKanban) }} />
      <Tab.Screen name="You" component={YouScreen} options={{ tabBarIcon: icon(CircleUser) }} />
    </Tab.Navigator>
  );
}
