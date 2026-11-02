import { useCallback, useEffect, useRef, useState } from "react";

/** A low-gain pure tone that can only start from an explicit user action. */
export function useStringAudio() {
  const context = useRef<AudioContext | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  const closeCurrent = useCallback(() => {
    request.current += 1;
    const active = context.current;
    context.current = null;
    void active?.close().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    closeCurrent();
    if (mounted.current) {
      setPlaying(false);
      setError("");
    }
  }, [closeCurrent]);

  useEffect(() => {
    mounted.current = true;
    const stopWhenHidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", stopWhenHidden);
      closeCurrent();
    };
  }, [closeCurrent, stop]);

  const play = useCallback(
    async (frequency: number, amplitude: number) => {
      if (amplitude <= 0) return;
      stop();
      const token = request.current;
      let active: AudioContext | null = null;
      try {
        active = new AudioContext();
        context.current = active;
        setPlaying(true);
        await active.resume();
        if (token !== request.current) {
          void active.close().catch(() => undefined);
          return;
        }
        const oscillator = active.createOscillator();
        const gain = active.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, active.currentTime);
        const lowGain = Math.min(0.018, 0.006 + (amplitude / 8) * 0.012);
        gain.gain.linearRampToValueAtTime(lowGain, active.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          active.currentTime + 0.8,
        );
        oscillator.connect(gain).connect(active.destination);
        oscillator.onended = () => {
          void active?.close().catch(() => undefined);
          if (token === request.current && context.current === active) {
            context.current = null;
            if (mounted.current) setPlaying(false);
          }
        };
        oscillator.start();
        oscillator.stop(active.currentTime + 0.85);
      } catch {
        void active?.close().catch(() => undefined);
        if (token === request.current && mounted.current) {
          context.current = null;
          setPlaying(false);
          setError(
            "Audio is unavailable in this browser. The visual trace and measurements still provide the comparison.",
          );
        }
      }
    },
    [stop],
  );

  return { playing, error, play, stop };
}
