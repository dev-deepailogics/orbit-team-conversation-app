'use client';

import React, { useEffect, useRef } from 'react';
import {
  CarouselLayout,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  isTrackReference,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { RoomEvent, Track } from 'livekit-client';

const sameTrack = (a?: TrackReferenceOrPlaceholder, b?: TrackReferenceOrPlaceholder) =>
  !!a && !!b && a.participant.identity === b.participant.identity && a.source === b.source;

/**
 * The call's video area: participant grid, a focus view that auto-pins a shared screen, and the control bar.
 * This is LiveKit's VideoConference layout without its built-in chat panel and chat button, so the only chat in a
 * call is Orbit's own in-call chat (ModernMeetingChat), opened from the call header.
 */
export const CallConference: React.FC = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  const layoutContext = useCreateLayoutContext();
  const lastAutoFocusedScreenShare = useRef<TrackReferenceOrPlaceholder | null>(null);

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((t) => t.publication.source === Track.Source.ScreenShare);
  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((t) => !sameTrack(t, focusTrack));

  useEffect(() => {
    // A shared screen is pinned automatically (unless something is already pinned) and unpinned when it ends.
    if (screenShareTracks.some((t) => t.publication.isSubscribed) && lastAutoFocusedScreenShare.current === null) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShare.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShare.current &&
      !screenShareTracks.some(
        (t) => t.publication.trackSid === (lastAutoFocusedScreenShare.current as any)?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShare.current = null;
    }
    // A pinned placeholder is swapped for the real track once that participant publishes one.
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updated = tracks.find(
        (t) => t.participant.identity === focusTrack.participant.identity && t.source === focusTrack.source,
      );
      if (updated !== focusTrack && isTrackReference(updated)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updated });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screenShareTracks.map((t) => `${t.publication.trackSid}_${t.publication.isSubscribed}`).join(),
    (focusTrack as any)?.publication?.trackSid,
    tracks,
  ]);

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider value={layoutContext}>
        <div className="lk-video-conference-inner">
          {focusTrack ? (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <ParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={focusTrack} />
              </FocusLayoutContainer>
            </div>
          ) : (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={tracks}>
                <ParticipantTile />
              </GridLayout>
            </div>
          )}
          <ControlBar controls={{ chat: false, settings: false }} />
        </div>
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
};
