/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { registerGlobals } from '@livekit/react-native';
import App from './App';
import { name as appName } from './app.json';

// WebRTC globals LiveKit needs (calls); must run before any LiveKit code.
registerGlobals();

AppRegistry.registerComponent(appName, () => App);
