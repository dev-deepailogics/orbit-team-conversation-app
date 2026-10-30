import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Message } from '@orbit/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { channelLabel, channelPrefix, isDirect } from '@/features/workspaces/utils';
import { getErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { ScreenProps } from '@/navigation/types';
import { Composer } from '../components/Composer';
import { MessageActionsSheet } from '../components/MessageActionsSheet';
import { MessageItem } from '../components/MessageItem';
import { sendReply, toggleReaction } from '../services/chatApi';
import { useChatStore } from '../store';

// Pushed on top of ChannelScreen, which stays mounted and keeps the channel room (where replies arrive) joined.
export function ThreadScreen({ route, navigation }: ScreenProps<'Thread'>) {
  const { colors } = useTheme();
  const { channelId, messageId } = route.params;
  const myId = useAuthStore(s => s.user?.id);
  const channel = useWorkspaceStore(s => s.current?.channels.find(c => c.id === channelId));
  const thread = useChatStore(s => s.thread);
  const openThread = useChatStore(s => s.openThread);
  const closeThread = useChatStore(s => s.closeThread);
  const receiveMessage = useChatStore(s => s.receiveMessage);
  const setReactions = useChatStore(s => s.setReactions);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);

  useEffect(() => {
    openThread(messageId);
    return () => closeThread(messageId);
  }, [messageId, openThread, closeThread]);

  const handleSend = async (text: string) => {
    try {
      receiveMessage(await sendReply(messageId, text));
      return true;
    } catch (err) {
      Alert.alert('Reply not sent', getErrorMessage(err, 'Please try again.'));
      return false;
    }
  };

  const handleReaction = useCallback(
    async (m: Message, emoji: string) => {
      try {
        setReactions(m.id, await toggleReaction(m.id, emoji));
      } catch (err) {
        Alert.alert('Reaction failed', getErrorMessage(err, 'Please try again.'));
      }
    },
    [setReactions],
  );

  const subtitle = channel
    ? isDirect(channel)
      ? channelLabel(channel, myId)
      : `${channelPrefix(channel)}${channelLabel(channel, myId)}`
    : undefined;
  const { parent, replies } = thread;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Thread" subtitle={subtitle} onBack={navigation.goBack} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        {!parent && thread.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.mutedForeground} />
          </View>
        ) : !parent ? (
          <View className="flex-1 items-center justify-center gap-4 p-6">
            <Text className="text-center text-muted-foreground">{thread.error || 'Thread not found.'}</Text>
            <Button variant="outline" onPress={() => openThread(messageId)}>
              <Text>Retry</Text>
            </Button>
          </View>
        ) : (
          <FlashList
            data={replies}
            keyExtractor={m => m.id}
            renderItem={({ item, index }) => (
              <MessageItem
                message={item}
                prev={replies[index - 1]}
                myId={myId}
                onLongPress={setActionTarget}
                onToggleReaction={handleReaction}
              />
            )}
            maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="pt-2">
                <MessageItem
                  message={parent}
                  prev={undefined}
                  myId={myId}
                  onLongPress={setActionTarget}
                  onToggleReaction={handleReaction}
                />
                <View className="my-3 flex-row items-center gap-3 px-4">
                  <Text className="text-sm font-bold text-muted-foreground">
                    {replies.length === 1 ? '1 reply' : `${replies.length} replies`}
                  </Text>
                  <View className="h-px flex-1 bg-border" />
                  {thread.isLoading && <ActivityIndicator color={colors.mutedForeground} size="small" />}
                </View>
                {!!thread.error && <Text className="px-4 text-sm text-destructive">{thread.error}</Text>}
              </View>
            }
          />
        )}
        <Composer placeholder="Reply…" onSend={handleSend} />
      </KeyboardAvoidingView>

      <MessageActionsSheet message={actionTarget} onClose={() => setActionTarget(null)} onReact={handleReaction} />
    </SafeAreaView>
  );
}
