import { useState } from 'react';
import { Image, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { SERVER_URL } from '@/lib/config';
import { avatarTones, onSwatch } from '@/lib/theme';
import { cn, initials } from '@/lib/utils';

interface Props {
  name: string;
  // The user's/bot's avatarUrl: an upload (/api/files/download/…) or a DiceBear preset (/api/avatar/<style>/svg).
  url?: string | null;
  // Anonymous persona emoji or 🤖 for bots; replaces initials.
  emoji?: string | null;
  className?: string;
}


export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1_000_003;
  return avatarTones[h % avatarTones.length];
}

const fill = { width: '100%', height: '100%' } as const;

export function Avatar({ name, url, emoji, className }: Props) {
  // Broken/unreachable image → fall back to initials (keyed by url so a new url gets a fresh try).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && url !== failedUrl) {
    const uri = url.startsWith('/') ? SERVER_URL + url : url;
    const onError = () => setFailedUrl(url);
    return (
      <View className={cn('h-9 w-9 overflow-hidden rounded-lg bg-muted', className)} accessibilityLabel={name}>
        {/* RN's <Image> can't draw SVG (the DiceBear presets). */}
        {/\/svg(\?|$)|\.svg$/i.test(url) ? (
          <SvgUri uri={uri} width="100%" height="100%" onError={onError} />
        ) : (
          <Image source={{ uri }} style={fill} resizeMode="cover" onError={onError} />
        )}
      </View>
    );
  }

  return (
    <View
      className={cn('h-9 w-9 items-center justify-center rounded-lg', emoji && 'bg-muted', className)}
      style={emoji ? undefined : { backgroundColor: avatarTone(name) }}
    >
      <Text className={cn('font-bold', emoji ? 'text-lg' : 'text-sm')} style={emoji ? undefined : { color: onSwatch }}>{emoji || initials(name)}</Text>
    </View>
  );
}
