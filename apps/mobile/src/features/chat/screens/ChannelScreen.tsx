import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Message } from '@orbit/types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/workspaces/store';
import { channelLabel, channelPrefix, isDirect } from '@/features/workspaces/utils';
import { getErrorMessage } from '@/lib/api';
import { EVENTS, getSocket } from '@/lib/socket';
import type { ScreenProps } from '@/navigation/types';
import { AddChannelMembersSheet } from '@/features/workspaces/components/AddChannelMembersSheet';
import { ChatHeader } from '../components/ChatHeader';
import { Composer } from '../components/Composer';
import { MessageActionsSheet } from '../components/MessageActionsSheet';
import { MessageItem } from '../components/MessageItem';
import { sendMessage, toggleReaction } from '../services/chatApi';
import { useChatStore } from '../store';
import { typingLabel } from '../utils';

export function ChannelScreen({ route, navigation }: ScreenProps<'Channel'>) {
  const { channelId } = route.params;
  const me = useAuthStore(s => s.user);
  const channel = useWorkspaceStore(s => s.current?.channels.find(c => c.id === channelId));
  const clearUnread = useWorkspaceStore(s => s.clearUnread);
  const messages = useChatStore(s => s.messages);
  const hasMore = useChatStore(s => s.hasMore);
  const isLoading = useChatStore(s => s.isLoading);
  const isLoadingOlder = useChatStore(s => s.isLoadingOlder);
  const error = useChatStore(s => s.error);
  const typing = useChatStore(s => s.typing);
  const openChannel = useChatStore(s => s.openChannel);
  const closeChannel = useChatStore(s => s.closeChannel);
  const loadOlder = useChatStore(s => s.loadOlder);
  const receiveMessage = useChatStore(s => s.receiveMessage);
  const setReactions = useChatStore(s => s.setReactions);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [showAddPeople, setShowAddPeople] = useState(false);

  useEffect(() => {
    openChannel(channelId);
    clearUnread(channelId);
    // Typing, reactions and thread replies are broadcast to the channel room only.
    getSocket()?.emit(EVENTS.JOIN_CHANNEL, channelId);
    return () => {
      getSocket()?.emit(EVENTS.LEAVE_CHANNEL, channelId);
      closeChannel(channelId);
    };
  }, [channelId, openChannel, closeChannel, clearUnread]);

  // Someone deleted the channel while it was open (channel:deleted removes it from the store).
  const existed = useRef(!!channel);
  useEffect(() => {
    if (channel) {
      existed.current = true;
    } else if (existed.current) {
      Alert.alert('Channel deleted', 'This channel was deleted.');
      navigation.goBack();
    }
  }, [channel, navigation]);

  const handleSend = async (text: string) => {
    try {
      receiveMessage(await sendMessage(channelId, text));
      return true;
    } catch (err) {
      Alert.alert('Message not sent', getErrorMessage(err, 'Please try again.'));
      return false;
    }
  };

  const handleTyping = (isTyping: boolean) =>
    getSocket()?.emit(
      isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP,
      isTyping ? { channelId, username: me?.displayName } : { channelId },
    );

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

  const openThread = useCallback(
    (m: Message) => navigation.navigate('Thread', { channelId, messageId: m.id }),
    [navigation, channelId],
  );

  if (!channel) {
    return (
      <SafeAreaView className="flex-1 bg-slack-darkBg">
        <ChatHeader title="Channel" onBack={navigation.goBack} />
        <Text className="p-6 text-center text-gray-400">This channel is no longer available.</Text>
      </SafeAreaView>
    );
  }

  const label = channelLabel(channel, me?.id);
  const direct = isDirect(channel);
  const title = direct ? label : `${channelPrefix(channel)} ${label}`;
  const memberCount = channel.members?.length ?? 0;
  const typingText = typingLabel(Object.values(typing));

  return (
    <SafeAreaView className="flex-1 bg-slack-darkBg" edges={['top', 'bottom']}>
      <ChatHeader
        title={title}
        subtitle={direct ? undefined : memberCount === 1 ? '1 member' : `${memberCount} members`}
        onBack={navigation.goBack}
        action={direct ? undefined : { label: 'Add people', onPress: () => setShowAddPeople(true) }}
      />
      {/* Android runs edge-to-edge (gradle.properties), where adjustResize no longer resizes the window. */}
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        {isLoading && messages.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="white" />
          </View>
        ) : error && messages.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4 p-6">
            <Text className="text-center text-gray-300">{error}</Text>
            <Button className="bg-slack-activeChannel" onPress={() => openChannel(channelId)}>
              <Text className="text-white">Retry</Text>
            </Button>
          </View>
        ) : (
          <FlashList
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item, index }) => (
              <MessageItem
                message={item}
                prev={messages[index - 1]}
                myId={me?.id}
                onLongPress={setActionTarget}
                onToggleReaction={handleReaction}
                onOpenThread={openThread}
              />
            )}
            maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
            onStartReached={loadOlder}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              isLoadingOlder ? (
                <ActivityIndicator color="white" className="py-4" />
              ) : !hasMore ? (
                <View className="gap-1 px-4 pb-2 pt-6">
                  <Text className="text-xl font-bold text-white">{title}</Text>
                  <Text className="text-sm text-gray-400">
                    {direct
                      ? `This is the very beginning of your conversation with ${label}.`
                      : `This is the very beginning of the ${channelPrefix(channel)}${label} channel.${channel.topic ? ` ${channel.topic}` : ''}`}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
        <Text className="h-5 px-4 text-xs italic text-gray-400" numberOfLines={1}>
          {typingText}
        </Text>
        <Composer placeholder={direct ? `Message ${label}` : `Message ${channelPrefix(channel)}${label}`} onSend={handleSend} onTyping={handleTyping} />
      </KeyboardAvoidingView>

      {!direct && (
        <AddChannelMembersSheet visible={showAddPeople} channel={channel} onClose={() => setShowAddPeople(false)} />
      )}
      <MessageActionsSheet
        message={actionTarget}
        onClose={() => setActionTarget(null)}
        onReact={handleReaction}
        onReplyInThread={openThread}
      />
    </SafeAreaView>
  );
}
