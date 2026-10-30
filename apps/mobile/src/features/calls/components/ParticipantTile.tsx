import { StyleSheet, View } from 'react-native';
import {
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Avatar } from '@/components/Avatar';
import { MicOff } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
  trackRef: TrackReferenceOrPlaceholder;
  // Front camera previews are mirrored, like every camera app.
  mirror?: boolean;
  className?: string;
}

// A participant's camera (or screen share); initials when their video is off.
export function ParticipantTile({ trackRef, mirror, className }: Props) {
  const { colors } = useTheme();
  const { participant } = trackRef;
  const speaking = useIsSpeaking(participant);
  const videoMuted = useIsMuted(trackRef);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const name = participant.name || participant.identity;
  const label = isScreen ? `${name}'s screen` : participant.isLocal ? `${name} (you)` : name;

  return (
    <View
      className={cn('overflow-hidden rounded-xl border-2 bg-muted', speaking && !isScreen ? 'border-success' : 'border-transparent', className)}
      accessibilityLabel={`${label}${micMuted && !isScreen ? ', muted' : ''}`}
    >
      {isTrackReference(trackRef) && !videoMuted ? (
        <VideoTrack trackRef={trackRef} style={styles.video} objectFit={isScreen ? 'contain' : 'cover'} mirror={mirror} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Avatar name={name} className="h-16 w-16 rounded-2xl" />
        </View>
      )}
      <View className="absolute bottom-2 left-2 max-w-[90%] flex-row items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5">
        {micMuted && !isScreen && <MicOff size={12} color={colors.destructive} />}
        <Text className="text-xs font-semibold" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ video: { flex: 1 } });
