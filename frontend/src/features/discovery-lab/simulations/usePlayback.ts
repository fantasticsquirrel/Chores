import { useEffect, useRef, useState } from "react";
export function usePlayback(duration = 12, loop = true, initialProgress = 0) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgressState] = useState(initialProgress);
  const position = useRef(initialProgress);
  const setProgress = (value: number) => {
    position.current = value;
    setProgressState(value);
  };
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) {
        const next =
          position.current + Math.min(now - last, 50) / (duration * 1000);
        if (!loop && next >= 0.9999) {
          setProgress(0.9999);
          setPlaying(false);
          return;
        }
        setProgress(loop ? next % 1 : next);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, loop]);
  // All animation is opt-in, including on reduced-motion devices. Manual scrub stays available.
  return {
    playing,
    progress,
    setProgress,
    toggle: () => {
      if (!playing && position.current >= 0.9999) setProgress(0);
      setPlaying((p) => !p);
    },
    reset: () => {
      setPlaying(false);
      setProgress(0);
    },
  };
}
