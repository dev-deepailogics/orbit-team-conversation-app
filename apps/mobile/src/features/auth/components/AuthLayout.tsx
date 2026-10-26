import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

interface Props {
  title: string;
  subtitle: string;
  error: string;
  children: ReactNode;
}

// Shared shell for Login/Register, mirroring apps/web/src/app/login/page.tsx.
export function AuthLayout({ title, subtitle, error, children }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-center justify-center gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-slack-activeChannel">
              <Text className="text-xl font-black text-white">O</Text>
            </View>
            <Text className="text-2xl font-black tracking-tight text-white">ORBIT</Text>
          </View>

          <Text className="mb-2 text-center text-xl font-bold text-white">{title}</Text>
          <Text className="mb-6 text-center text-xs text-gray-400">{subtitle}</Text>

          {!!error && (
            <View className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <Text className="text-xs text-red-400">{error}</Text>
            </View>
          )}

          <View className="gap-4">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
