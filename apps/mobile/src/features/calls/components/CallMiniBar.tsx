import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalParticipant } from '@livekit/react-native';
import { Headphones, Mic, MicOff, PhoneOff } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { useCallTitle } from '../hooks/useCallTitle';
import { useCallStore } from '../store';

// Floating pill while the call is minimized (the web's MinimizedFloatingWidget): tap to return to the call.
export function CallMiniBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = useCallTitle();
  const setMinimized = useCallStore(s => s.setMinimized);
  const leave = useCallStore(s => s.leave);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  return (
    <View pointerEvents="box-none" className="absolute right-3" style={{ top: insets.top + 60 }}>
      <View className="flex-row items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 shadow-lg shadow-overlay/15">
        <Pressable
          onPress={() => setMinimized(false)}
          className="min-h-[40px] flex-row items-center gap-2"
          accessibilityRole="button"
          accessibilityLabel={`Return to call in ${title}`}
        >
          <Headphones size={16} color={colors.success} />
          <Text className="max-w-[140px] text-sm font-semibold" numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => {})}
          accessibilityLabel={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        >
          {isMicrophoneEnabled ? <Mic size={18} color={colors.foreground} /> : <MicOff size={18} color={colors.destructive} />}
        </Button>
        <Button variant="destructive" size="icon" className="rounded-full" onPress={leave} accessibilityLabel="Leave call">
          <PhoneOff size={18} color={colors.destructiveForeground} />
        </Button>
      </View>
    </View>
  );
}
