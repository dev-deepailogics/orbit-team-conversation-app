import { memo } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { ChevronRight, Paperclip } from '@/components/icons';
import type { Message } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  fileUrl,
  formatBytes,
  formatDay,
  formatTime,
  groupReactions,
  isImage,
  isNewDay,
  senderEmoji,
  senderName,
  showHeader,
} from '../utils';
import type { Gallery } from './ImageViewer';
import { MarkdownText } from './MarkdownText';

interface Props {
  message: Message;
  prev: Message | undefined;
  myId: string | undefined;
  onLongPress: (m: Message) => void;
  onToggleReaction: (m: Message, emoji: string) => void;
  onOpenImages: (gallery: Gallery) => void;
  // Omitted inside a thread, where replies don't have their own threads.
  onOpenThread?: (m: Message) => void;
}

export const MessageItem = memo(function MessageItemView({
  message: m,
  prev,
  myId,
  onLongPress,
  onToggleReaction,
  onOpenImages,
  onOpenThread,
}: Props) {
  const { colors } = useTheme();
  const header = showHeader(prev, m);
  const reactions = groupReactions(m.reactions, myId);
  const name = senderName(m);
  const attachments = (m.attachments ?? []).filter(a => !a.isDeleted);
  const images = attachments.filter(a => isImage(a.fileType));
  const files = attachments.filter(a => !isImage(a.fileType));

  return (
    <View>
      {isNewDay(prev, m) && (
        // Slack's day divider: a pill sitting on a hairline.
        <View className="my-3 justify-center">
          <View className="absolute left-0 right-0 h-px bg-border" />
          <View className="self-center rounded-full border border-border bg-background px-3 py-1">
            <Text className="text-xs font-bold">{formatDay(m.createdAt)}</Text>
          </View>
        </View>
      )}
      <Pressable
        onLongPress={m.isDeleted ? undefined : () => onLongPress(m)}
        delayLongPress={300}
        className={cn('flex-row gap-2 px-4 pb-1 active:bg-muted', header ? 'pt-2.5' : 'pt-0')}
      >
        <View className="w-9">{header && <Avatar name={name} emoji={senderEmoji(m)} />}</View>
        <View className="flex-1">
          {header && (
            <View className="flex-row items-baseline gap-2">
              <Text className="shrink font-bold" numberOfLines={1}>
                {name}
              </Text>
              {!!m.bot && <Text className="rounded bg-muted px-1 text-2xs font-bold text-muted-foreground">APP</Text>}
              <Text className="text-xs text-muted-foreground">{formatTime(m.createdAt)}</Text>
            </View>
          )}

          {m.isDeleted ? (
            <Text className="italic text-muted-foreground">This message was deleted.</Text>
          ) : (
            !!m.content && (
              <View>
                <MarkdownText content={m.content} />
                {m.isEdited && <Text className="text-xs text-subtle">(edited)</Text>}
              </View>
            )
          )}

          {!m.isDeleted && images.length > 0 && (
            <View className="mt-1.5 flex-row flex-wrap gap-1.5">
              {images.map((img, i) => (
                <Pressable
                  key={img.id}
                  onPress={() => onOpenImages({ images, index: i })}
                  className="overflow-hidden rounded-lg border border-border bg-muted"
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Open ${img.fileName}`}
                >
                  <Image
                    source={{ uri: fileUrl(img) }}
                    className={images.length === 1 ? 'h-48 w-64' : 'h-28 w-28'}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Non-image files open in the browser, which previews PDFs/video and downloads the rest. */}
          {!m.isDeleted &&
            files.map(f => (
              <Pressable
                key={f.id}
                onPress={() => Linking.openURL(fileUrl(f))}
                className="mt-1.5 flex-row items-center gap-2 self-start rounded-lg border border-border px-3 py-2 active:bg-muted"
                accessibilityRole="link"
                accessibilityLabel={`Open ${f.fileName}`}
              >
                <Paperclip size={14} color={colors.mutedForeground} />
                <Text className="shrink text-sm font-bold" numberOfLines={1}>
                  {f.fileName}
                </Text>
                <Text className="text-xs text-muted-foreground">{formatBytes(f.fileSize)}</Text>
              </Pressable>
            ))}

          {reactions.length > 0 && (
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              {reactions.map(r => (
                <Pressable
                  key={r.emoji}
                  onPress={() => onToggleReaction(m, r.emoji)}
                  hitSlop={4}
                  className={cn(
                    'h-7 flex-row items-center gap-1 rounded-full border px-2',
                    r.mine ? 'border-link bg-accent' : 'border-transparent bg-muted',
                  )}
                  accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', you reacted' : ''}`}
                >
                  <Text className="text-sm">{r.emoji}</Text>
                  <Text className={cn('text-xs font-bold', r.mine ? 'text-accent-foreground' : 'text-muted-foreground')}>{r.count}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {onOpenThread && !!m.replyCount && (
            <Pressable onPress={() => onOpenThread(m)} hitSlop={8} className="mt-1 flex-row items-center gap-0.5 self-start">
              <Text className="text-sm font-bold text-link">
                {m.replyCount === 1 ? '1 reply' : `${m.replyCount} replies`}
              </Text>
              <ChevronRight size={14} color={colors.link} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
});
