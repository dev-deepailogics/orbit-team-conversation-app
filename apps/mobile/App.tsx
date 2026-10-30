import './global.css';

import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WorkspaceControlScreen } from '@/features/workspaces/screens/WorkspaceControlScreen';
import { AdminConsoleScreen } from '@/features/admin/screens/AdminConsoleScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { useAuthStore } from '@/features/auth/store';
import { ChannelScreen } from '@/features/chat/screens/ChannelScreen';
import { ThreadScreen } from '@/features/chat/screens/ThreadScreen';
import { NewMessageScreen } from '@/features/dms/screens/NewMessageScreen';
import { ProjectBoardScreen } from '@/features/projects/screens/ProjectBoardScreen';
import { TicketDetailScreen } from '@/features/projects/screens/TicketDetailScreen';
import { NotificationHost } from '@/features/notifications/components/NotificationHost';
import { FONT, perScheme, useTheme } from '@/lib/theme';
import { useSettingsStore } from '@/features/settings/store';
import { MainTabs } from '@/navigation/MainTabs';
import { navigationRef } from '@/navigation/ref';
import type { RootStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Native headers and tab labels pick up the palette and Lato from here.
const navTheme = perScheme<Theme>((c, scheme) => ({
  ...DefaultTheme,
  dark: scheme === 'dark',
  colors: {
    primary: c.link,
    background: c.background,
    card: c.background,
    text: c.foreground,
    border: c.border,
    notification: c.destructive,
  },
  fonts: {
    regular: { fontFamily: FONT, fontWeight: '400' },
    medium: { fontFamily: FONT, fontWeight: '700' },
    bold: { fontFamily: FONT, fontWeight: '700' },
    heavy: { fontFamily: FONT, fontWeight: '900' },
  },
}));

function RootNavigator() {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);
  const bootError = useAuthStore(s => s.bootError);
  const fetchMe = useAuthStore(s => s.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  if (bootError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        <Text className="text-center text-muted-foreground">{bootError}</Text>
        <Button variant="outline" onPress={fetchMe}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  // Swapping screen sets on `user` is React Navigation's recommended auth pattern:
  // no manual navigate() after login/logout, and Back can't return to a signed-out screen.
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', headerTintColor: colors.foreground }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Channel"
            component={ChannelScreen}
            options={{ animation: 'default' }}
          />
          <Stack.Screen
            name="Thread"
            component={ThreadScreen}
            options={{ animation: 'default' }}
          />
          <Stack.Screen
            name="NewMessage"
            component={NewMessageScreen}
            options={{
              headerShown: true,
              title: 'New message',
              presentation: 'modal',
              animation: 'default',
            }}
          />
          <Stack.Screen name="ProjectBoard" component={ProjectBoardScreen} options={{ animation: 'default' }} />
          <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ animation: 'default' }} />
          {user.systemRole === 'SUPER_ADMIN' && (
            <Stack.Screen
              name="WorkspaceControl"
              component={WorkspaceControlScreen}
              options={{ headerShown: true, title: 'Workspace control', animation: 'default' }}
            />
          )}
          {user.systemRole === 'SUPER_ADMIN' && (
            <Stack.Screen
              name="AdminConsole"
              component={AdminConsoleScreen}
              options={{
                headerShown: true,
                title: 'Admin Console',
                animation: 'default',
              }}
            />
          )}
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function App() {
  const { scheme, cssVars } = useTheme();
  const hydrateSettings = useSettingsStore(s => s.hydrate);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return (
    <SafeAreaProvider>
      {/* Theme tokens (bg-background, text-foreground, …) resolve from these variables, modals included. */}
      <View style={cssVars} className="flex-1 bg-background">
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <NavigationContainer ref={navigationRef} theme={navTheme[scheme]}>
          <RootNavigator />
          <NotificationHost />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

export default App;
