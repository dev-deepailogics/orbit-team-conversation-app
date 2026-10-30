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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10 flex-row items-center justify-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand">
              <Text className="text-lg font-black text-brand-foreground">O</Text>
            </View>
            <Text className="text-2xl font-black">orbit</Text>
          </View>

          <Text className="mb-2 text-center text-3xl font-black">{title}</Text>
          <Text className="mb-8 text-center text-muted-foreground">{subtitle}</Text>

          {!!error && (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          <View className="gap-4">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
