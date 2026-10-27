import './global.css';

import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AdminConsoleScreen } from '@/features/admin/screens/AdminConsoleScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { RegisterScreen } from '@/features/auth/screens/RegisterScreen';
import { useAuthStore } from '@/features/auth/store';
import { ChannelScreen } from '@/features/chat/screens/ChannelScreen';
import { ThreadScreen } from '@/features/chat/screens/ThreadScreen';
import { NewMessageScreen } from '@/features/dms/screens/NewMessageScreen';
import { MainTabs } from '@/navigation/MainTabs';
import type { RootStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// The app is dark-only for now, matching the web auth screens.
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#1A1D21' } };

function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const bootError = useAuthStore((s) => s.bootError);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slack-darkBg">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (bootError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
        <Text className="text-center text-gray-300">{bootError}</Text>
        <Button className="bg-slack-activeChannel" onPress={fetchMe}>
          <Text className="text-white">Retry</Text>
        </Button>
      </View>
    );
  }

  // Swapping screen sets on `user` is React Navigation's recommended auth pattern:
  // no manual navigate() after login/logout, and Back can't return to a signed-out screen.
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Channel" component={ChannelScreen} options={{ animation: 'default' }} />
          <Stack.Screen name="Thread" component={ThreadScreen} options={{ animation: 'default' }} />
          <Stack.Screen
            name="NewMessage"
            component={NewMessageScreen}
            options={{ headerShown: true, title: 'New message', presentation: 'modal', animation: 'default' }}
          />
          {user.systemRole === 'SUPER_ADMIN' && (
            <Stack.Screen
              name="AdminConsole"
              component={AdminConsoleScreen}
              options={{ headerShown: true, title: 'Admin Console', animation: 'default' }}
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
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
