import { View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';
import { useAvailabilityStore } from '../store';
import { presenceOf, type Presence } from '../utils';

const DOT: Record<Presence, string> = {
  working: 'bg-success',
  break: 'bg-warning',
  off: 'bg-subtle',
};

export function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  return <View className={cn('h-2.5 w-2.5 rounded-full', DOT[presence], className)} />;
}

// The signed-in user's avatar with their availability dot. `ringClassName` matches the surface behind it.
export function PresenceAvatar({
  name,
  url,
  className,
  ringClassName = 'border-background',
}: {
  name: string;
  url?: string | null;
  className?: string;
  ringClassName?: string;
}) {
  const presence = useAvailabilityStore(s => presenceOf(s.record));
  return (
    <View>
      <Avatar name={name} url={url} className={className} />
      <PresenceDot
        presence={presence}
        className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 border-[2.5px]', ringClassName)}
      />
    </View>
  );
}
