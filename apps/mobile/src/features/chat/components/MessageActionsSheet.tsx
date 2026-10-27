import { Pressable, View } from 'react-native';
import type { Message } from '@orbit/types';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/ui/text';
import { senderName } from '../utils';

// Same quick picks as Slack's long-press menu. ponytail: full emoji picker comes in Phase 2.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];

interface Props {
  message: Message | null;
  onClose: () => void;
  onReact: (m: Message, emoji: string) => void;
  onReplyInThread?: (m: Message) => void;
}

export function MessageActionsSheet({ message, onClose, onReact, onReplyInThread }: Props) {
  if (!message) return null;
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Sheet visible title={senderName(message)} onClose={onClose}>
      {!!message.content && (
        <Text className="-mt-2 text-sm text-gray-400" numberOfLines={2}>
          {message.content}
        </Text>
      )}
      <View className="flex-row justify-between">
        {QUICK_REACTIONS.map(emoji => (
          <Pressable
            key={emoji}
            onPress={act(() => onReact(message, emoji))}
            className="h-12 w-12 items-center justify-center rounded-full bg-white/5 active:bg-white/15"
            accessibilityLabel={`React with ${emoji}`}
          >
            <Text className="text-2xl">{emoji}</Text>
          </Pressable>
        ))}
      </View>
      {onReplyInThread && (
        <Pressable
          onPress={act(() => onReplyInThread(message))}
          className="min-h-[48px] flex-row items-center gap-3 rounded-lg px-2 active:bg-white/5"
          accessibilityRole="button"
        >
          <Text className="text-lg">💬</Text>
          <Text className="text-base text-white">Reply in thread</Text>
        </Pressable>
      )}
    </Sheet>
  );
}
