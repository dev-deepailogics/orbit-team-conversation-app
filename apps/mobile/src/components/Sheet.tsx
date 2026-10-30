import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Tall form sheets (long forms with a keyboard) get most of the screen instead of hugging their content.
  fullHeight?: boolean;
}

// Slack-style bottom sheet built on RN's Modal (Android back button → onRequestClose).
export function Sheet({ visible, title, onClose, children, fullHeight }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="absolute inset-0 bg-overlay/40" onPress={onClose} accessibilityLabel="Close" />
        <View
          className={cn('gap-4 rounded-t-3xl bg-background px-5 pt-2.5', fullHeight && 'h-[92%]')}
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="h-1 w-9 self-center rounded-full bg-border" />
          <Text className="text-lg font-bold">{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
