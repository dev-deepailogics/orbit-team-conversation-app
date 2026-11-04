import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  type Event,
} from '@notifee/react-native';
import { useAuthStore } from '@/features/auth/store';
import { useCallStore } from './store';
import type { IncomingCall } from './types';
import { incomingCallTitle, parseIncomingCall } from './utils';

// Matches the in-app banner's RING_MS.
const RING_MS = 30_000;
const ANDROID_CHANNEL = 'calls';

// Android only: the server sends calls as data-only pushes so we can draw Answer/Decline.
// iOS gets a plain alert from APNs (a real lock-screen call UI needs CallKit + PushKit).
export async function showIncomingCall(call: IncomingCall) {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ANDROID_CHANNEL,
    name: 'Incoming calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibrationPattern: [300, 700, 300, 700],
  });
  await notifee.displayNotification({
    id: call.channelId,
    title: incomingCallTitle(call),
    body: 'Voice, video and screen share',
    data: { ...call, type: 'call' },
    android: {
      channelId: ANDROID_CHANNEL,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,
      autoCancel: false,
      loopSound: true,
      lightUpScreen: true,
      timeoutAfter: RING_MS,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Decline', pressAction: { id: 'decline' } },
        { title: 'Answer', pressAction: { id: 'answer', launchActivity: 'default' } },
      ],
    },
  });
}

export function cancelIncomingCall(channelId: string) {
  if (Platform.OS === 'android') notifee.cancelNotification(channelId).catch(() => {});
}

// Answer joins; tapping the body opens the app on the in-app ringing banner; Decline just stops the ringing.
export function handleCallPress(call: IncomingCall, action: string) {
  cancelIncomingCall(call.channelId);
  if (action === 'decline') return;
  // A press can arrive in a headless JS context before sign-in has loaded; the cold-start
  // getInitialNotification in CallHost covers that case.
  if (!useAuthStore.getState().user) return;
  if (action === 'answer') {
    useCallStore.getState().join({ id: call.channelId, name: call.channelName, workspaceId: call.workspaceId });
  } else {
    useCallStore.getState().ring(call);
  }
}

export function handleCallEvent({ type, detail }: Event) {
  if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
  const call = parseIncomingCall(detail.notification?.data);
  if (call) handleCallPress(call, detail.pressAction?.id ?? 'default');
}
