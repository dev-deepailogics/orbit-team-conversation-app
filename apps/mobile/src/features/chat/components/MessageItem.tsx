import { memo } from 'react';
import { Pressable, View } from 'react-native';
import type { Message } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { formatDay, formatTime, groupReactions, isNewDay, senderEmoji, senderName, showHeader } from '../utils';
import { MarkdownText } from './MarkdownText';

interface Props {
  message: Message;
  prev: Message | undefined;
  myId: string | undefined;
  onLongPress: (m: Message) => void;
  onToggleReaction: (m: Message, emoji: string) => void;
  // Omitted inside a thread, where replies don't have their own threads.
  onOpenThread?: (m: Message) => void;
}

export const MessageItem = memo(function MessageItemView({
  message: m,
  prev,
  myId,
  onLongPress,
  onToggleReaction,
  onOpenThread,
}: Props) {
  const header = showHeader(prev, m);
  const reactions = groupReactions(m.reactions, myId);
  const name = senderName(m);
  const files = (m.attachments ?? []).filter(a => !a.isDeleted);

  return (
    <View>
      {isNewDay(prev, m) && (
        <View className="my-2 flex-row items-center gap-2 px-4">
          <View className="h-px flex-1 bg-slack-darkBorder" />
          <Text className="text-xs font-semibold text-gray-400">{formatDay(m.createdAt)}</Text>
          <View className="h-px flex-1 bg-slack-darkBorder" />
        </View>
      )}
      <Pressable
        onLongPress={m.isDeleted ? undefined : () => onLongPress(m)}
        delayLongPress={300}
        className={cn('flex-row gap-2.5 px-4 pb-1 active:bg-white/5', header ? 'pt-2' : 'pt-0.5')}
      >
        <View className="w-9">{header && <Avatar name={name} emoji={senderEmoji(m)} />}</View>
        <View className="flex-1">
          {header && (
            <View className="flex-row items-baseline gap-2">
              <Text className="shrink text-[15px] font-bold text-white" numberOfLines={1}>
                {name}
              </Text>
              {!!m.bot && <Text className="rounded bg-gray-700 px-1 text-[10px] font-bold text-gray-300">APP</Text>}
              <Text className="text-xs text-gray-500">{formatTime(m.createdAt)}</Text>
            </View>
          )}

          {m.isDeleted ? (
            <Text className="text-[15px] italic text-gray-500">This message was deleted.</Text>
          ) : (
            !!m.content && (
              <View>
                <MarkdownText content={m.content} />
                {m.isEdited && <Text className="text-xs text-gray-500">(edited)</Text>}
              </View>
            )
          )}

          {/* ponytail: names only; previews/downloads come with attachments in Phase 2. */}
          {!m.isDeleted &&
            files.map(f => (
              <Text key={f.id} className="mt-1 text-sm text-slack-activeChannel" numberOfLines={1}>
                📎 {f.fileName}
              </Text>
            ))}

          {reactions.length > 0 && (
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              {reactions.map(r => (
                <Pressable
                  key={r.emoji}
                  onPress={() => onToggleReaction(m, r.emoji)}
                  hitSlop={4}
                  className={cn(
                    'flex-row items-center gap-1 rounded-full border px-2 py-0.5',
                    r.mine ? 'border-slack-activeChannel bg-slack-activeChannel/25' : 'border-slack-darkBorder bg-white/5',
                  )}
                  accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', you reacted' : ''}`}
                >
                  <Text className="text-sm">{r.emoji}</Text>
                  <Text className={cn('text-xs', r.mine ? 'font-bold text-white' : 'text-gray-300')}>{r.count}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {onOpenThread && !!m.replyCount && (
            <Pressable onPress={() => onOpenThread(m)} hitSlop={8} className="mt-1 self-start">
              <Text className="text-sm font-semibold text-slack-activeChannel">
                {m.replyCount === 1 ? '1 reply' : `${m.replyCount} replies`}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
});
