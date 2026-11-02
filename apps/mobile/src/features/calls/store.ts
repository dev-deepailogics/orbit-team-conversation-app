import { Alert } from 'react-native';
import { create } from 'zustand';
import { AudioSession } from '@livekit/react-native';
import { DisconnectReason, Room, RoomEvent } from 'livekit-client';
import type { Channel } from '@orbit/types';
import { useAuthStore } from '@/features/auth/store';
import { getErrorMessage } from '@/lib/api';
import { EVENTS, getSocket } from '@/lib/socket';
import { endCallSession, startCallSession } from './services/callApi';
import type { ActiveCall, IncomingCall } from './types';

interface CallState {
  // The connected LiveKit room; CallHost provides it to the call UI via RoomContext.
  room: Room | null;
  call: ActiveCall | null;
  joining: boolean;
  minimized: boolean;
  incoming: IncomingCall | null;
  // Channels with a call in progress (LIVE badge). Only known from socket events since launch, same as web.
  live: Record<string, true>;
  join: (channel: Pick<Channel, 'id' | 'name' | 'workspaceId'>) => Promise<void>;
  leave: () => Promise<void>;
  setMinimized: (minimized: boolean) => void;
  ring: (call: IncomingCall) => void;
  dismiss: () => void;
  setLive: (channelId: string, live: boolean) => void;
  reset: () => Promise<void>;
}

// Shared by Leave and unexpected disconnects (kicked, room deleted, network gone).
function teardown(call: ActiveCall) {
  getSocket()?.emit(EVENTS.HUDDLE_LEFT, { channelId: call.channelId, workspaceId: call.workspaceId });
  AudioSession.stopAudioSession().catch(() => {});
}

export const useCallStore = create<CallState>((set, get) => ({
  room: null,
  call: null,
  joining: false,
  minimized: false,
  incoming: null,
  live: {},

  join: async channel => {
    const { call, joining } = get();
    if (joining) return;
    if (call?.channelId === channel.id) return set({ minimized: false, incoming: null });
    set({ joining: true, incoming: null });
    if (call) await get().leave();

    const room = new Room({ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true });
    try {
      const { token, serverUrl } = await startCallSession(channel.id);
      await AudioSession.startAudioSession();
      await room.connect(serverUrl, token);
    } catch (err) {
      room.disconnect().catch(() => {});
      AudioSession.stopAudioSession().catch(() => {});
      set({ joining: false });
      Alert.alert('Could not join the call', getErrorMessage(err, 'Could not connect to the call server. Please try again.'));
      return;
    }

    const active: ActiveCall = { channelId: channel.id, channelName: channel.name, workspaceId: channel.workspaceId };
    room.on(RoomEvent.Disconnected, reason => {
      if (get().room !== room) return; // we left on purpose
      set({ room: null, call: null, minimized: false });
      teardown(active);
      if (reason === DisconnectReason.ROOM_DELETED) Alert.alert('Call ended', 'The call has ended.');
      else if (reason === DisconnectReason.PARTICIPANT_REMOVED) Alert.alert('Removed from call', 'You were removed from the call.');
      else if (reason !== DisconnectReason.CLIENT_INITIATED) Alert.alert('Call disconnected', 'You lost connection to the call.');
    });
    set(s => ({ room, call: active, joining: false, minimized: false, live: { ...s.live, [channel.id]: true } }));

    const me = useAuthStore.getState().user;
    getSocket()?.emit(EVENTS.HUDDLE_JOINED, {
      channelId: channel.id,
      workspaceId: channel.workspaceId,
      user: me && { id: me.id, displayName: me.displayName, username: me.username, avatarUrl: me.avatarUrl },
    });
    // Join even without a mic (denied permission, simulator): you can still listen and watch.
    room.localParticipant.setMicrophoneEnabled(true).catch(() =>
      Alert.alert('Microphone unavailable', 'Allow microphone access for Orbit in Settings so others can hear you.'),
    );
  },

  leave: async () => {
    const { room, call } = get();
    if (!room || !call) return;
    // The web ends the huddle for everyone when anyone leaves; like Slack, only the last one out ends it.
    const last = room.remoteParticipants.size === 0;
    set({ room: null, call: null, minimized: false });
    teardown(call);
    await room.disconnect().catch(() => {});
    if (last) {
      get().setLive(call.channelId, false);
      endCallSession(call.channelId).catch(() => {});
    }
  },

  setMinimized: minimized => set({ minimized }),

  // huddle:started also fires each time someone joins (every joiner calls /start), so ignore calls we're in.
  ring: incoming => {
    if (get().call?.channelId === incoming.channelId) return;
    set({ incoming });
  },
  dismiss: () => set({ incoming: null }),

  setLive: (channelId, live) =>
    set(s => {
      if (!!s.live[channelId] === live) return s;
      const next = { ...s.live };
      if (live) next[channelId] = true;
      else delete next[channelId];
      return { live: next };
    }),

  reset: async () => {
    await get().leave();
    set({ joining: false, incoming: null, live: {} });
  },
}));
