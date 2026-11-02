import { useEffect } from 'react';
import { Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Phone, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { useCallStore } from '../store';
import { incomingCallTitle } from '../utils';

// The web rings until answered; on a phone stop after a while so a missed call doesn't buzz forever.
const RING_MS = 30_000;
const RING_PATTERN = [0, 700, 1000];

export function IncomingCallBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const incoming = useCallStore(s => s.incoming);
  const joining = useCallStore(s => s.joining);
  const dismiss = useCallStore(s => s.dismiss);
  const join = useCallStore(s => s.join);

  useEffect(() => {
    if (!incoming) return;
    Vibration.vibrate(RING_PATTERN, true);
    const t = setTimeout(dismiss, RING_MS);
    return () => {
      Vibration.cancel();
      clearTimeout(t);
    };
  }, [incoming, dismiss]);

  if (!incoming) return null;
  return (
    <View pointerEvents="box-none" className="absolute left-3 right-3" style={{ top: insets.top + 8 }}>
      <View
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-background p-3 shadow-lg shadow-overlay/15"
        accessibilityLiveRegion="polite"
      >
        <Avatar name={incoming.callerName} />
        <View className="flex-1">
          <Text className="font-bold" numberOfLines={2}>
            {incomingCallTitle(incoming)}
          </Text>
          <Text className="text-xs text-muted-foreground">Voice, video and screen share</Text>
        </View>
        <Button variant="secondary" size="icon" className="rounded-full" onPress={dismiss} accessibilityLabel="Decline call">
          <X size={20} color={colors.foreground} />
        </Button>
        <Button
          size="icon"
          className="rounded-full bg-success active:bg-success/90"
          disabled={joining}
          onPress={() => join({ id: incoming.channelId, name: incoming.channelName, workspaceId: incoming.workspaceId })}
          accessibilityLabel="Join call"
        >
          <Phone size={20} color={colors.successForeground} />
        </Button>
      </View>
    </View>
  );
}
