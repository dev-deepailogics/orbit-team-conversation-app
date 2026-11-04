/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { registerGlobals } from '@livekit/react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { cancelIncomingCall, handleCallEvent, showIncomingCall } from './src/features/calls/notification';
import { parseIncomingCall } from './src/features/calls/utils';

// WebRTC globals LiveKit needs (calls); must run before any LiveKit code.
registerGlobals();

// Both must be registered outside React: they run headless when the app is backgrounded or killed.
// Android call pushes are data-only (no OS notification), so we draw the ringing one ourselves.
setBackgroundMessageHandler(getMessaging(), async msg => {
  const call = parseIncomingCall(msg.data);
  if (call) await showIncomingCall(call);
  else if (msg.data?.type === 'call_ended' && typeof msg.data.channelId === 'string') cancelIncomingCall(msg.data.channelId);
});
notifee.onBackgroundEvent(async event => handleCallEvent(event));

AppRegistry.registerComponent(appName, () => App);
