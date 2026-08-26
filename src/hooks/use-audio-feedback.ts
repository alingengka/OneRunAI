import { useCallback } from 'react';
import { audioSystem } from '@/lib/audio-system';

export function useAudioFeedback() {
  const play = useCallback((type: Parameters<typeof audioSystem.play>[0]) => {
    // Wrap in a try-catch to avoid crashing on browser restrictions or context issues
    try {
      audioSystem.play(type);
    } catch (e) {
      console.warn('Audio playback failed', e);
    }
  }, []);

  return {
    play,
    setVolume: (vol: number) => audioSystem.setVolume(vol),
    setEnabled: (enabled: boolean) => audioSystem.setEnabled(enabled),
    setPack: (pack: Parameters<typeof audioSystem.setPack>[0]) => audioSystem.setPack(pack),
  };
}
