import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/features/auth/store';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useNotificationStore } from '../store';
import { openTarget } from '../utils';

const BANNER_MS = 4000;

function Banner() {
  const banner = useNotificationStore(s => s.banner);
  const dismiss = useNotificationStore(s => s.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(dismiss, BANNER_MS);
    return () => clearTimeout(t);
  }, [banner, dismiss]);

  if (!banner) return null;
  return (
    <View pointerEvents="box-none" className="absolute left-3 right-3" style={{ top: insets.top + 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open notification: ${banner.title}`}
        onPress={() => {
          dismiss();
          openTarget(banner);
        }}
        className="rounded-2xl border border-border bg-background px-4 py-3 shadow-lg shadow-overlay/15">
        <Text className="font-bold" numberOfLines={1}>
          {banner.title}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={2}>
          {banner.body}
        </Text>
      </Pressable>
    </View>
  );
}

function SignedInHost() {
  usePushNotifications();
  return <Banner />;
}

// Rendered once at the app root (above every screen) and only while signed in.
export function NotificationHost() {
  const signedIn = useAuthStore(s => !!s.user);
  return signedIn ? <SignedInHost /> : null;
}
