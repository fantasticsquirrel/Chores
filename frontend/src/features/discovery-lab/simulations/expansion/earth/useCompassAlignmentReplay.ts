import { useCallback, useEffect, useRef, useState } from "react";

/** Opt-in orientation replay; its duration is illustrative, not physical time. */
export function useCompassAlignmentReplay(stateKey: string) {
  const frame = useRef<number | null>(null);
  const [alignmentProgress, setAlignmentProgress] = useState<number | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
    setAlignmentProgress(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus("");
  }, [stop]);

  useEffect(() => cancel(), [stateKey, cancel]);
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
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus(
        "Reduced motion is on; the final compass directions stay shown.",
      );
      return;
    }
    const start = performance.now();
    setRunning(true);
    setStatus(
      "Replaying ideal compass alignment with the local combined field; the replay duration is not physical time.",
    );
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1_100);
      const eased = 1 - (1 - progress) ** 3;
      // Twelve visible steps keep scene replacement bounded on low-power devices.
      setAlignmentProgress(Math.round(eased * 12) / 12);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setAlignmentProgress(null);
      setStatus(
        "Replay complete: each north-seeking end follows its local field.",
      );
    };
    frame.current = requestAnimationFrame(tick);
  }, [stop]);

  return {
    alignmentProgress: alignmentProgress ?? 1,
    cancel,
    replay,
    running,
    status,
  };
}
