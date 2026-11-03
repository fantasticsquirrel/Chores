import { useCallback, useEffect, useRef, useState } from "react";

export const formatPlateTime = (elapsedMillionYears: number) =>
  elapsedMillionYears.toFixed(2).replace(/0$/, "");

export function usePlateMotionReplay(elapsedMillionYears: number) {
  const frame = useRef<number | null>(null);
  const [visualTime, setVisualTime] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
    setVisualTime(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus("");
  }, [stop]);

  useEffect(() => cancel(), [elapsedMillionYears, cancel]);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    const cancelWhenHidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", cancelWhenHidden);
  }, [cancel]);

  const replay = useCallback(() => {
    stop();
    if (elapsedMillionYears <= 0) {
      setStatus("Increase elapsed model time before replaying the sweep.");
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus(
        "Reduced motion is on; the final calculated relative motion stays shown.",
      );
      return;
    }
    const start = performance.now();
    setRunning(true);
    setStatus(
      "Replaying a schematic sweep from zero to the selected elapsed-time input; this is not real-time plate motion.",
    );
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1_300);
      const eased = 1 - (1 - progress) ** 3;
      setVisualTime(elapsedMillionYears * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setVisualTime(null);
      setStatus(
        `Replay complete at ${formatPlateTime(elapsedMillionYears)} million years. The sweep was illustrative, not geological speed.`,
      );
    };
    frame.current = requestAnimationFrame(tick);
  }, [elapsedMillionYears, stop]);

  return {
    cancel,
    replay,
    running,
    status,
    visualElapsedMillionYears: visualTime ?? elapsedMillionYears,
  };
}
