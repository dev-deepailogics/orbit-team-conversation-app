import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';

// Placeholder signed-in screen until the workspace/channel UI lands.
export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-slack-darkBg p-6">
      <View className="items-center gap-1">
        <Text className="text-xl font-bold text-white">Hi, {user?.displayName}</Text>
        <Text className="text-sm text-gray-400">@{user?.username} · {user?.email}</Text>
      </View>
      <Button variant="destructive" onPress={logout}>
        <Text>Sign out</Text>
      </Button>
    </SafeAreaView>
  );
}
