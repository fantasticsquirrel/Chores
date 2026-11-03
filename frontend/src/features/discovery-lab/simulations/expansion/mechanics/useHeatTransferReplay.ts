import { useCallback, useEffect, useRef, useState } from "react";

export function useHeatTransferReplay(elapsedHours: number) {
  const frame = useRef<number | null>(null);
  const [visualHours, setVisualHours] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
    setVisualHours(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus("");
  }, [stop]);

  useEffect(() => cancel(), [elapsedHours, cancel]);
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
    if (elapsedHours <= 0) {
      setStatus(
        "Set elapsed time above zero before replaying energy transfer.",
      );
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus(
        "Reduced motion is on; the final " +
          elapsedHours +
          "-hour energy total stays shown.",
      );
      return;
    }
    const start = performance.now();
    setRunning(true);
    setStatus(
      "Replaying energy accumulation from 0 to " +
        elapsedHours +
        " hours while heat-transfer power stays constant.",
    );
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1200);
      setVisualHours(elapsedHours * progress);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setVisualHours(null);
      setStatus(
        "Replay complete: power stayed constant while energy accumulated for " +
          elapsedHours +
          " hours.",
      );
    };
    frame.current = requestAnimationFrame(tick);
  }, [elapsedHours, stop]);

  return {
    cancel,
    replay,
    running,
    status,
    visualHours: visualHours ?? elapsedHours,
  };
}
