import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, findNodeHandle, Modal, NativeModules, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioSession,
  isTrackReference,
  useChat,
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import { ConnectionState, Track } from 'livekit-client';
import {
  ChevronDown,
  MessageSquareText,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume1,
  Volume2,
  type LucideIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useCallStore } from '../store';
import { useCallTitle } from '../hooks/useCallTitle';
import { CallChat } from './CallChat';
import { ParticipantTile } from './ParticipantTile';

type Facing = 'user' | 'environment';

function Control({
  icon: Icon,
  label,
  active,
  danger,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      className={cn('items-center gap-1', disabled && 'opacity-50')}
    >
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-full',
          danger ? 'bg-destructive' : active ? 'bg-foreground' : 'bg-muted',
        )}
      >
        <Icon size={22} color={danger ? colors.destructiveForeground : active ? colors.background : colors.foreground} />
      </View>
      <Text className="text-2xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

// Full-screen call UI. Stays mounted while minimized (only the Modal hides) so speaker/camera state survive.
export function CallScreen({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = useCallTitle();
  const setMinimized = useCallStore(s => s.setMinimized);
  const leave = useCallStore(s => s.leave);
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const { chatMessages, send, isSending } = useChat();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [facing, setFacing] = useState<Facing>('user');
  const [speaker, setSpeaker] = useState(true);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const pickerRef = useRef<ComponentRef<typeof ScreenCapturePickerView>>(null);

  const screen = tracks.find(t => t.source === Track.Source.ScreenShare && isTrackReference(t));
  const cameras = tracks.filter(t => t.source === Track.Source.Camera);
  const unreadChat = !chatOpen && chatMessages.length > seenChat;

  // Group call: start on the loudspeaker (Android's communication mode defaults to the earpiece).
  useEffect(() => {
    if (Platform.OS === 'android') AudioSession.selectAudioOutput('speaker').catch(() => {});
  }, []);

  useEffect(() => {
    if (chatOpen) setSeenChat(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  // One device toggle at a time: they all renegotiate tracks, and double taps would race.
  const run = async (fn: () => Promise<unknown>, failTitle: string, failMessage: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      Alert.alert(failTitle, failMessage);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () =>
    run(
      () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
      'Microphone unavailable',
      'Allow microphone access for Orbit in Settings.',
    );

  const toggleCamera = () =>
    run(
      () => localParticipant.setCameraEnabled(!isCameraEnabled, { facingMode: facing }),
      'Camera unavailable',
      'Allow camera access for Orbit in Settings.',
    );

  const flipCamera = () =>
    run(
      async () => {
        const next: Facing = facing === 'user' ? 'environment' : 'user';
        await localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.restartTrack({ facingMode: next });
        setFacing(next);
      },
      'Could not switch camera',
      'Please try again.',
    );

  const toggleSpeaker = () => {
    // iOS only lets apps force the speaker; the system picker also covers Bluetooth and AirPlay.
    if (Platform.OS === 'ios') return AudioSession.showAudioRoutePicker().catch(() => {});
    run(
      async () => {
        await AudioSession.selectAudioOutput(speaker ? 'earpiece' : 'speaker');
        setSpeaker(!speaker);
      },
      'Could not switch audio',
      'Please try again.',
    );
  };

  const toggleScreenShare = () =>
    run(
      async () => {
        if (isScreenShareEnabled) return localParticipant.setScreenShareEnabled(false);
        // iOS captures the screen in the OrbitScreenShare broadcast extension; this opens the system's start sheet.
        // ponytail: if the user cancels that sheet an empty share stays published until they tap Stop; detect via the extension if it bothers people.
        if (Platform.OS === 'ios') {
          const tag = findNodeHandle(pickerRef.current);
          if (tag) await NativeModules.ScreenCapturePickerViewManager.show(tag);
        }
        await localParticipant.setScreenShareEnabled(true);
      },
      'Screen sharing failed',
      'Please try again.',
    );

  const status =
    connection === ConnectionState.Reconnecting || connection === ConnectionState.SignalReconnecting
      ? 'Reconnecting…'
      : connection === ConnectionState.Connecting
        ? 'Connecting…'
        : cameras.length === 1
          ? 'Just you'
          : `${cameras.length} people`;

  // Grid: 1 column for 1–2 people, 2 after that; tiles share the height until they hit a readable minimum.
  const columns = cameras.length <= 2 ? 1 : 2;
  const rows = Math.ceil(cameras.length / columns);
  const tileHeight = Math.max(160, (gridHeight - 8 * rows) / Math.max(rows, 1));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => setMinimized(true)}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
        <View className="min-h-[52px] flex-row items-center gap-1 px-1.5">
          <Button variant="ghost" size="icon" onPress={() => setMinimized(true)} accessibilityLabel="Minimize call">
            <ChevronDown size={26} color={colors.foreground} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-xs text-muted-foreground">{status}</Text>
          </View>
          <Button variant="ghost" size="icon" onPress={() => setChatOpen(true)} accessibilityLabel="Meeting chat">
            <MessageSquareText size={22} color={colors.foreground} />
            {unreadChat && <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive" />}
          </Button>
        </View>

        {screen ? (
          <View className="flex-1 gap-2 px-2">
            <ParticipantTile trackRef={screen} className="flex-1" />
            <View className="h-28">
              <FlashList
                horizontal
                data={cameras}
                keyExtractor={t => t.participant.identity}
                renderItem={({ item }) => (
                  <ParticipantTile
                    trackRef={item}
                    mirror={item.participant.isLocal && facing === 'user'}
                    className="mr-2 h-28 w-24"
                  />
                )}
              />
            </View>
          </View>
        ) : (
          <View className="flex-1 px-2" onLayout={e => setGridHeight(e.nativeEvent.layout.height)}>
            <FlashList
              data={cameras}
              numColumns={columns}
              extraData={tileHeight}
              keyExtractor={t => t.participant.identity}
              renderItem={({ item }) => (
                <View className="p-1" style={{ height: tileHeight }}>
                  <ParticipantTile
                    trackRef={item}
                    mirror={item.participant.isLocal && facing === 'user'}
                    className="flex-1"
                  />
                </View>
              )}
            />
          </View>
        )}

        <View className="flex-row justify-evenly px-2 pt-3">
          <Control
            icon={isMicrophoneEnabled ? Mic : MicOff}
            label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            active={isMicrophoneEnabled}
            disabled={busy}
            onPress={toggleMic}
          />
          <Control
            icon={isCameraEnabled ? Video : VideoOff}
            label="Video"
            active={isCameraEnabled}
            disabled={busy}
            onPress={toggleCamera}
          />
          {isCameraEnabled && <Control icon={SwitchCamera} label="Flip" disabled={busy} onPress={flipCamera} />}
          <Control
            icon={speaker ? Volume2 : Volume1}
            label={Platform.OS === 'ios' ? 'Audio' : 'Speaker'}
            active={Platform.OS === 'android' && speaker}
            disabled={busy}
            onPress={toggleSpeaker}
          />
          <Control
            icon={isScreenShareEnabled ? ScreenShareOff : ScreenShare}
            label={isScreenShareEnabled ? 'Stop' : 'Share'}
            active={isScreenShareEnabled}
            disabled={busy}
            onPress={toggleScreenShare}
          />
          <Control icon={PhoneOff} label="Leave" danger onPress={leave} />
        </View>

        {Platform.OS === 'ios' && (
          // Must be in the view tree for ScreenCapturePickerViewManager.show(); tapped programmatically, so hidden.
          <View pointerEvents="none" style={styles.hiddenPicker}>
            <ScreenCapturePickerView ref={pickerRef} />
          </View>
        )}
        <CallChat
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={chatMessages}
          send={send}
          isSending={isSending}
          myIdentity={localParticipant.identity}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({ hiddenPicker: { position: 'absolute', width: 1, height: 1, opacity: 0 } });
