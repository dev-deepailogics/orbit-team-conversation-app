import { useEffect } from 'react';
import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { RoomContext } from '@livekit/react-native';
import type { Room } from 'livekit-client';
import { useAuthStore } from '@/features/auth/store';
import { cancelIncomingCall, handleCallEvent, handleCallPress } from '../notification';
import { useCallStore } from '../store';
import { parseIncomingCall } from '../utils';
import { CallMiniBar } from './CallMiniBar';
import { CallScreen } from './CallScreen';
import { IncomingCallBanner } from './IncomingCallBanner';

function ActiveCall({ room }: { room: Room }) {
  const minimized = useCallStore(s => s.minimized);
  return (
    <RoomContext.Provider value={room}>
      <CallScreen visible={!minimized} />
      {minimized && <CallMiniBar />}
    </RoomContext.Provider>
  );
}

function SignedInHost() {
  const room = useCallStore(s => s.room);
  const callChannelId = useCallStore(s => s.call?.channelId);
  // Signing out hangs up.
  useEffect(
    () => () => {
      useCallStore.getState().reset();
    },
    [],
  );

  // Ringing notification presses (Android). A cold start from Answer lands in getInitialNotification,
  // since onBackgroundEvent fired before sign-in loaded; join() ignores the duplicate if both arrive.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    notifee.getInitialNotification().then(initial => {
      const call = parseIncomingCall(initial?.notification.data);
      if (call) handleCallPress(call, initial!.pressAction.id);
    });
    return notifee.onForegroundEvent(handleCallEvent);
  }, []);

  // Joined from the in-app banner while the notification was still ringing.
  useEffect(() => {
    if (callChannelId) cancelIncomingCall(callChannelId);
  }, [callChannelId]);
  return (
    <>
      <IncomingCallBanner />
      {room && <ActiveCall room={room} />}
    </>
  );
}

// Rendered once at the app root (above every screen) so a call survives navigation, like the web's HuddleModal.
export function CallHost() {
  const signedIn = useAuthStore(s => !!s.user);
  return signedIn ? <SignedInHost /> : null;
}
