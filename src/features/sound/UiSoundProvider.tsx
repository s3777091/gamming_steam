import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';

export type UiSound = 'focus' | 'navigate' | 'select' | 'confirm' | 'back' | 'transition';

type UiSoundSettings = {
  enabled: boolean;
  volume: number;
};

type UiSoundContextValue = UiSoundSettings & {
  ready: boolean;
  play: (sound: UiSound) => void;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
};

const STORAGE_KEY = 'jetsona.ui-sounds.v1';
const DEFAULT_SETTINGS: UiSoundSettings = { enabled: true, volume: 0.55 };
const SOURCES: Record<UiSound, number> = {
  focus: require('../../../assets/sounds/ui-focus.wav'),
  navigate: require('../../../assets/sounds/ui-navigate.wav'),
  select: require('../../../assets/sounds/ui-select.wav'),
  confirm: require('../../../assets/sounds/ui-confirm.wav'),
  back: require('../../../assets/sounds/ui-back.wav'),
  transition: require('../../../assets/sounds/ui-transition.wav'),
};
const SOUND_GAIN: Record<UiSound, number> = {
  focus: 0.72,
  navigate: 0.8,
  select: 0.82,
  confirm: 0.9,
  back: 0.78,
  transition: 0.7,
};
const MIN_INTERVAL_MS: Record<UiSound, number> = {
  focus: 42,
  navigate: 48,
  select: 54,
  confirm: 120,
  back: 100,
  transition: 140,
};

const UiSoundContext = createContext<UiSoundContextValue | null>(null);

let globalPlay: ((sound: UiSound) => void) | null = null;

/** Plays a cue from non-React navigation code. It is a no-op until the provider has hydrated. */
export function playUiSound(sound: UiSound): void {
  globalPlay?.(sound);
}

export function UiSoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(DEFAULT_SETTINGS.enabled);
  const [volume, setVolumeState] = useState(DEFAULT_SETTINGS.volume);
  const [hydrated, setHydrated] = useState(false);
  const [playersReady, setPlayersReady] = useState(false);
  const players = useRef<Partial<Record<UiSound, AudioPlayer>>>({});
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const readyRef = useRef(false);
  const lastPlayed = useRef<Partial<Record<UiSound, number>>>({});

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { readyRef.current = hydrated && playersReady; }, [hydrated, playersReady]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as Partial<UiSoundSettings>;
        if (typeof parsed.enabled === 'boolean') setEnabledState(parsed.enabled);
        if (typeof parsed.volume === 'number') setVolumeState(Math.max(0, Math.min(1, parsed.volume)));
      })
      .catch(() => {})
      .finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let disposed = false;
    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).then(() => {
      if (disposed) return;
      const next: Partial<Record<UiSound, AudioPlayer>> = {};
      (Object.keys(SOURCES) as UiSound[]).forEach((sound) => {
        const player = createAudioPlayer(SOURCES[sound], { downloadFirst: true, keepAudioSessionActive: true });
        player.volume = volumeRef.current * SOUND_GAIN[sound];
        next[sound] = player;
      });
      players.current = next;
      setPlayersReady(true);
    }).catch(() => {});
    return () => {
      disposed = true;
      Object.values(players.current).forEach((player) => player?.remove());
      players.current = {};
    };
  }, []);

  useEffect(() => {
    Object.entries(players.current).forEach(([sound, player]) => {
      if (player) player.volume = volume * SOUND_GAIN[sound as UiSound];
    });
  }, [volume]);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume })).catch(() => {});
  }, [enabled, hydrated, volume]);

  const play = useCallback((sound: UiSound) => {
    if (!readyRef.current || !enabledRef.current || volumeRef.current <= 0) return;
    const now = Date.now();
    if (now - (lastPlayed.current[sound] ?? 0) < MIN_INTERVAL_MS[sound]) return;
    const player = players.current[sound];
    if (!player) return;
    lastPlayed.current[sound] = now;
    player.volume = volumeRef.current * SOUND_GAIN[sound];
    if (player.currentTime > 0.005 || player.playing) {
      void player.seekTo(0).then(() => player.play()).catch(() => {});
    } else {
      try { player.play(); } catch { /* Audio feedback must never block the interaction. */ }
    }
  }, []);

  useEffect(() => {
    globalPlay = play;
    return () => { if (globalPlay === play) globalPlay = null; };
  }, [play]);

  const setEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabledState(next);
    if (next) setTimeout(() => play('confirm'), 0);
  }, [play]);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    volumeRef.current = clamped;
    setVolumeState(clamped);
  }, []);

  const value = useMemo<UiSoundContextValue>(() => ({
    enabled,
    volume,
    ready: hydrated && playersReady,
    play,
    setEnabled,
    setVolume,
  }), [enabled, hydrated, play, playersReady, setEnabled, setVolume, volume]);

  return <UiSoundContext.Provider value={value}>{children}</UiSoundContext.Provider>;
}

export function useUiSounds(): UiSoundContextValue {
  const value = useContext(UiSoundContext);
  if (!value) throw new Error('useUiSounds must be used inside UiSoundProvider');
  return value;
}
