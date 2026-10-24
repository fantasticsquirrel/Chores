import { useEffect, useRef, useState } from "react";

/** Audio starts only from a user click, ends after 850ms, and stops on unmount. */
export function useStringAudio() {
  const context = useRef<AudioContext | null>(null);
  const request = useRef(0);
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      request.current++;
      void context.current?.close().catch(() => undefined);
      context.current = null;
    },
    [],
  );
  const stop = () => {
    request.current++;
    void context.current?.close().catch(() => undefined);
    context.current = null;
    setPlaying(false);
    setError("");
  };
  const play = async (frequency: number, amplitude: number) => {
    if (amplitude <= 0) return;
    stop();
    const token = request.current;
    let active: AudioContext | null = null;
    try {
      active = new AudioContext();
      context.current = active;
      setPlaying(true);
      await active.resume();
      if (token !== request.current) return;
      const oscillator = active.createOscillator(),
        gain = active.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, active.currentTime);
      gain.gain.linearRampToValueAtTime(
        amplitude / 100,
        active.currentTime + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, active.currentTime + 0.8);
      oscillator.connect(gain).connect(active.destination);
      oscillator.onended = () => {
        void active?.close().catch(() => undefined);
        if (token === request.current && context.current === active) {
          context.current = null;
          setPlaying(false);
        }
      };
      oscillator.start();
      oscillator.stop(active.currentTime + 0.85);
    } catch {
      void active?.close().catch(() => undefined);
      if (token === request.current) {
        context.current = null;
        setPlaying(false);
        setError(
          "Audio is unavailable in this browser. The wave and measurements still work.",
        );
      }
    }
  };
  return { playing, error, play, stop };
}
