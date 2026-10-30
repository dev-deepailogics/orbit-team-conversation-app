import { useEffect } from 'react';
import { RoomContext } from '@livekit/react-native';
import type { Room } from 'livekit-client';
import { useAuthStore } from '@/features/auth/store';
import { useCallStore } from '../store';
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
  // Signing out hangs up.
  useEffect(
    () => () => {
      useCallStore.getState().reset();
    },
    [],
  );
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
