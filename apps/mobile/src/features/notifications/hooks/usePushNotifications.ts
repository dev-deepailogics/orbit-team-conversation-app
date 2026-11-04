import { useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { useChatStore } from '@/features/chat/store';
import { cancelIncomingCall } from '@/features/calls/notification';
import { useCallStore } from '@/features/calls/store';
import { parseIncomingCall } from '@/features/calls/utils';
import { useNotificationStore } from '../store';
import { registerPushToken } from '../services/pushToken';
import { isViewing, openTarget, parseTarget } from '../utils';

// RNFirebase's requestPermission is a no-op on Android (always "authorized"), so Android 13+ needs the real prompt.
async function askPermission(m: ReturnType<typeof getMessaging>) {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) return true;
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await requestPermission(m);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

// Mounted while signed in. Closed/background app: the OS shows the FCM notification and a tap lands here.
// Foreground: FCM shows nothing, so we draw our own banner (unless that conversation is already open).
// Call pushes: Android draws its own ringing notification (index.js); iOS gets an OS alert whose tap rings in-app.
function open(data: Record<string, unknown> | undefined) {
  const call = parseIncomingCall(data);
  if (call) return useCallStore.getState().ring(call);
  const target = parseTarget(data);
  if (target) openTarget(target);
}

export function usePushNotifications() {
  useEffect(() => {
    let cancelled = false;
    const m = getMessaging();

    const sync = async () => {
      try {
        const ok = await askPermission(m);
        if (!ok || cancelled) return;
        const token = await getToken(m);
        if (token && !cancelled) await registerPushToken(token);
      } catch (err) {
        // No APNs token on the iOS simulator, offline, etc.: retried on next launch.
        console.warn('Push registration failed', err);
      }
    };
    sync();

    const offToken = onTokenRefresh(m, t => registerPushToken(t).catch(() => {}));

    const offMessage = onMessage(m, async msg => {
      // In the foreground the socket already rings (huddle:started); this only stops a ring left over from background.
      if (msg.data?.type === 'call_ended' && typeof msg.data.channelId === 'string') {
        return cancelIncomingCall(msg.data.channelId);
      }
      if (msg.data?.type === 'call') return;
      const target = parseTarget(msg.data);
      if (!target) return;
      const chat = useChatStore.getState();
      if (isViewing(target, { channelId: chat.channelId, threadParentId: chat.thread.parentId })) return;
      useNotificationStore.getState().show({
        ...target,
        title: msg.notification?.title ?? 'New message',
        body: msg.notification?.body ?? '',
      });
    });

    const offOpened = onNotificationOpenedApp(m, msg => open(msg.data));
    getInitialNotification(m).then(msg => open(msg?.data));

    return () => {
      cancelled = true;
      offToken();
      offMessage();
      offOpened();
    };
  }, []);
}
