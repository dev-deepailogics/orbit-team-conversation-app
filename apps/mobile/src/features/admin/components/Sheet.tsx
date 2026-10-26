import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Slack-style bottom sheet built on RN's Modal (Android back button → onRequestClose).
// ponytail: lives in admin until a second feature needs it, then move to src/components/.
export function Sheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} accessibilityLabel="Close" />
        <View
          className="gap-4 rounded-t-2xl border-t border-slack-darkBorder bg-slack-darkSidebar px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="h-1 w-10 self-center rounded-full bg-gray-600" />
          <Text className="text-lg font-bold text-white">{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
