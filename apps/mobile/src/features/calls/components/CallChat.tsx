import { useState } from 'react';
import { Alert, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { useChat } from '@livekit/react-native';
import { SendHorizontal } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { parseCallChat } from '../utils';

interface Props {
  visible: boolean;
  onClose: () => void;
  messages: ReturnType<typeof useChat>['chatMessages'];
  send: (text: string) => Promise<unknown>;
  isSending: boolean;
  myIdentity: string;
}

const MAX_LENGTH = 2000;

// LiveKit's data-channel chat, shared with the web's meeting chat; nothing is saved to the channel.
export function CallChat({ visible, onClose, messages, send, isSending, myIdentity }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const submit = async () => {
    const t = text.trim();
    if (!t || isSending) return;
    try {
      await send(t);
      setText('');
    } catch {
      Alert.alert('Message not sent', 'Please try again.');
    }
  };

  return (
    <Sheet visible={visible} title="Meeting chat" onClose={onClose} fullHeight>
      <Text className="-mt-2 text-xs text-muted-foreground">Visible to everyone in this call. Not saved after it ends.</Text>
      <View className="flex-1">
        {messages.length === 0 ? (
          <Text className="pt-8 text-center text-muted-foreground">Send questions or comments to everyone in the call.</Text>
        ) : (
          <FlashList
            data={messages}
            keyExtractor={(m, i) => m.id || String(i)}
            maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const { text: body, replyTo } = parseCallChat(item.message);
              const sender = item.from?.identity === myIdentity ? 'You' : item.from?.name || item.from?.identity || 'Guest';
              return (
                <View className="gap-0.5 py-1.5">
                  <Text className="text-sm">
                    <Text className="text-sm font-bold">{sender}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {'  '}
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Text>
                  {replyTo && (
                    <Text className="border-l-2 border-border pl-2 text-xs text-muted-foreground" numberOfLines={2}>
                      {replyTo.senderName}: {replyTo.text}
                    </Text>
                  )}
                  <Text selectable>{body}</Text>
                </View>
              );
            }}
          />
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1"
          value={text}
          onChangeText={setText}
          placeholder="Message everyone"
          maxLength={MAX_LENGTH}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submit}
        />
        <Button size="icon" onPress={submit} disabled={!text.trim() || isSending} accessibilityLabel="Send message">
          <SendHorizontal size={20} color={colors.primaryForeground} />
        </Button>
      </View>
    </Sheet>
  );
}
