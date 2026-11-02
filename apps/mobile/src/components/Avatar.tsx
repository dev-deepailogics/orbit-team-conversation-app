import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { avatarTones, onSwatch } from '@/lib/theme';
import { cn, initials } from '@/lib/utils';

interface Props {
  name: string;
  // Anonymous persona emoji or 🤖 for bots; replaces initials.
  emoji?: string | null;
  className?: string;
}


export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1_000_003;
  return avatarTones[h % avatarTones.length];
}

// Initials instead of avatarUrl: server avatars are dicebear SVGs; ponytail: render them with react-native-svg's SvgUri if real avatars matter.
export function Avatar({ name, emoji, className }: Props) {
  return (
    <View
      className={cn('h-9 w-9 items-center justify-center rounded-lg', emoji && 'bg-muted', className)}
      style={emoji ? undefined : { backgroundColor: avatarTone(name) }}
    >
      <Text className={cn('font-bold', emoji ? 'text-lg' : 'text-sm')} style={emoji ? undefined : { color: onSwatch }}>{emoji || initials(name)}</Text>
    </View>
  );
}
