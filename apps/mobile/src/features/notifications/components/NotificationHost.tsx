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
        className="rounded-xl border border-slack-darkBorder bg-slack-darkSidebar p-3 shadow-lg">
        <Text className="font-semibold text-white" numberOfLines={1}>
          {banner.title}
        </Text>
        <Text className="text-sm text-gray-300" numberOfLines={2}>
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
