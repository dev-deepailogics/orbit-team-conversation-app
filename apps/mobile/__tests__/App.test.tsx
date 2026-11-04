/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Native Firebase modules don't exist under Jest.
jest.mock('@react-native-firebase/messaging', () => ({}));
jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));
// Neither do LiveKit's WebRTC modules; the App smoke test never starts a call.
jest.mock('@livekit/react-native', () => ({ AudioSession: {}, RoomContext: { Provider: ({ children }: any) => children } }));
jest.mock('@livekit/react-native-webrtc', () => ({}));
jest.mock('livekit-client', () => ({ Room: jest.fn(), RoomEvent: {}, DisconnectReason: {}, ConnectionState: {}, Track: { Source: {} } }));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
