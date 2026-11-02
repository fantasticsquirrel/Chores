import { useCallback, useEffect, useRef } from "react";
import { createTonePlayer, type Tone } from "./audio";

export function useTonePlayer() {
  const player = useRef<ReturnType<typeof createTonePlayer> | null>(null);
  const disposeTone = useCallback(() => {
    player.current?.dispose();
    player.current = null;
  }, []);
  const syncTones = useCallback(
    (previous: readonly Tone[] = [], next: readonly Tone[] = []) => {
      if (JSON.stringify(previous) !== JSON.stringify(next)) disposeTone();
    },
    [disposeTone],
  );

  useEffect(() => {
    const stopAudioWhenHidden = () => {
      if (window.document.hidden) disposeTone();
    };
    window.document.addEventListener("visibilitychange", stopAudioWhenHidden);
    return () => {
      window.document.removeEventListener(
        "visibilitychange",
        stopAudioWhenHidden,
      );
      disposeTone();
    };
  }, [disposeTone]);

  return {
    disposeTone,
    syncTones,
    playTone(tone: Tone) {
      player.current ??= createTonePlayer();
      return player.current.play(tone);
    },
  };
}
