import { useCallback, useEffect, useRef, useState } from "react";

/** Opt-in visual sweep; elapsed animation time is not atmospheric time. */
export function useCloudLiftReplay(targetLiftM: number) {
  const frame = useRef<number | null>(null);
  const [visualLiftM, setVisualLiftM] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
    setVisualLiftM(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus("");
  }, [stop]);

  useEffect(() => cancel(), [targetLiftM, cancel]);
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
    if (targetLiftM <= 0) {
      setStatus("Raise the parcel above 0 m before replaying its lift.");
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus(
        "Reduced motion is on; the final lift, temperature and humidity stay shown.",
      );
      return;
    }
    const start = performance.now();
    setRunning(true);
    setStatus(
      "Replaying parcel lift and cooling; the animation duration is illustrative, not atmospheric time.",
    );
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1_200);
      const eased = 1 - (1 - progress) ** 3;
      setVisualLiftM(targetLiftM * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setVisualLiftM(null);
      setStatus(`Replay complete at ${targetLiftM.toFixed(0)} m of lift.`);
    };
    frame.current = requestAnimationFrame(tick);
  }, [stop, targetLiftM]);

  return {
    cancel,
    replay,
    running,
    status,
    visualLiftM: visualLiftM ?? targetLiftM,
  };
}
