import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OPENING_DISSOLVE_TIME, OPENING_FINISH_TIME } from '@/lib/loading-sequence';

const TRAIN_LOOP = require('../../../assets/video/train_waiting_mobile.mp4');
const TRAIN_POSTER = require('../../../assets/video/train_waiting_poster.jpg');
const TRAIN_OPENING = require('../../../assets/video/train_opening_mobile.mp4');

/** One decoder at a time; useVideoPlayer owns disposal, including source changes. */
export function TrainVideo({ opening, playing, onDissolve, onEnded }: {
  opening: boolean;
  playing: boolean;
  onDissolve: () => void;
  onEnded: () => void;
}) {
  const [firstFrame, setFirstFrame] = useState(false);
  const player = useVideoPlayer(opening ? TRAIN_OPENING : TRAIN_LOOP, (p) => {
    p.loop = !opening;
    p.muted = true;
    p.timeUpdateEventInterval = opening ? 0.1 : 0;
  });
  useEffect(() => {
    if (playing) player.play(); else player.pause();
    // Expo releases the player before later effect cleanups. Calling pause in
    // cleanup would access an already released shared object and crash Android.
  }, [player, playing]);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!opening || !playing) return;
    if (currentTime >= OPENING_DISSOLVE_TIME) onDissolve();
    if (currentTime >= OPENING_FINISH_TIME) onEnded();
  });
  useEventListener(player, 'playToEnd', () => { if (opening) onEnded(); });
  useEventListener(player, 'statusChange', ({ status: videoStatus }) => {
    if (opening && videoStatus === 'error') onEnded();
  });
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover"
        nativeControls={false} allowsVideoFrameAnalysis={false} surfaceType="textureView"
        onFirstFrameRender={() => setFirstFrame(true)} />
      {!firstFrame ? <Image source={TRAIN_POSTER} style={StyleSheet.absoluteFill}
        contentFit="cover" transition={0} /> : null}
    </View>
  );
}
