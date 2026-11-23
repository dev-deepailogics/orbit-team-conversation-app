import { Pressable, View } from 'react-native';
import { Hash, Headphones, Lock, VenetianMask } from '@/components/icons';
import type { Channel } from '@orbit/types';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui/text';
import { useCallStore } from '@/features/calls/store';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { PresenceDot } from '@/features/availability/components/PresenceAvatar';
import { useAvailabilityStore } from '@/features/availability/store';
import { channelLabel, dmAvatarUrl, dmPeerId, isDirect } from '../utils';

const PRESENCE_LABEL = { working: 'available', break: 'on break', off: 'offline' } as const;

interface Props {
  channel: Channel;
  myId: string | undefined;
  unread: number;
  onPress: () => void;
}

export function ChannelRow({ channel, myId, unread, onPress }: Props) {
  const { colors } = useTheme();
  const label = channelLabel(channel, myId);
  const live = useCallStore(s => !!s.live[channel.id]);
  const peerId = dmPeerId(channel, myId);
  const presence = useAvailabilityStore(s => (peerId ? (s.team[peerId] ?? 'off') : undefined));
  const Icon = channel.isAnonymous ? VenetianMask : channel.type === 'PRIVATE' ? Lock : Hash;
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-3 px-4 py-2 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={[label, presence && PRESENCE_LABEL[presence], live && 'call in progress', unread && `${unread} unread`]
        .filter(Boolean)
        .join(', ')}
    >
      <View className="w-6 items-center">
        {isDirect(channel) ? (
          <View>
            <Avatar name={label} url={dmAvatarUrl(channel, myId)} className="h-6 w-6 rounded-md" />
            {presence && (
              <PresenceDot presence={presence} className="absolute -bottom-1 -right-1 h-3 w-3 border-2 border-background" />
            )}
          </View>
        ) : (
          <Icon size={18} strokeWidth={unread ? 2.5 : 2} color={unread ? colors.foreground : colors.mutedForeground} />
        )}
      </View>
      <Text className={cn('flex-1 text-lg', unread ? 'font-bold' : 'text-muted-foreground')} numberOfLines={1}>
        {label}
      </Text>
      {live && <Headphones size={16} color={colors.success} />}
      {unread > 0 && (
        <View className="h-5 min-w-[22px] items-center justify-center rounded-full bg-destructive px-1.5">
          <Text className="text-xs font-bold text-destructive-foreground">{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
