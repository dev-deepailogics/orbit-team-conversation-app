import { Pressable, View } from 'react-native';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { channelLabel, channelPrefix, isDirect } from '../utils';

interface Props {
  channel: Channel;
  myId: string | undefined;
  unread: number;
  onPress: () => void;
}

export function ChannelRow({ channel, myId, unread, onPress }: Props) {
  const label = channelLabel(channel, myId);
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-3 px-4 py-1.5 active:bg-white/5"
      accessibilityRole="button"
      accessibilityLabel={unread ? `${label}, ${unread} unread` : label}
    >
      {isDirect(channel) ? (
        <Avatar name={label} className="h-7 w-7 rounded-md" />
      ) : (
        <Text className="w-7 text-center text-lg text-gray-400">{channelPrefix(channel)}</Text>
      )}
      <Text
        className={cn('flex-1 text-base', unread ? 'font-bold text-white' : 'text-gray-300')}
        numberOfLines={1}
      >
        {label}
      </Text>
      {unread > 0 && (
        <View className="min-w-[22px] items-center rounded-full bg-red-600 px-1.5 py-0.5">
          <Text className="text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
