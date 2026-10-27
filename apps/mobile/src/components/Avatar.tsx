import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn, initials } from '@/lib/utils';

interface Props {
  name: string;
  // Anonymous persona emoji or 🤖 for bots; replaces initials.
  emoji?: string | null;
  className?: string;
}

// Initials instead of avatarUrl: server avatars are dicebear SVGs, which RN's Image can't render.
// ponytail: add react-native-svg (native) if real avatars matter.
export function Avatar({ name, emoji, className }: Props) {
  return (
    <View className={cn('h-9 w-9 items-center justify-center rounded-lg bg-slack-accent', className)}>
      <Text className={cn('font-bold text-white', emoji ? 'text-lg' : 'text-sm')}>{emoji || initials(name)}</Text>
    </View>
  );
}
