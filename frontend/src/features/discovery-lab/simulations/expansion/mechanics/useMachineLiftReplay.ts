import { useCallback, useEffect, useRef, useState } from "react";

export function useMachineLiftReplay(liftM: number) {
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

  useEffect(() => {
    cancel();
  }, [liftM, cancel]);

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
    if (liftM <= 0) {
      setStatus("Set a lift height above zero before replaying the movement.");
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus("Reduced motion is on; the final lift position stays shown.");
      return;
    }
    const start = performance.now();
    setRunning(true);
    setStatus("Replaying the load movement from 0 metres to the set height.");
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setVisualLiftM(liftM * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setVisualLiftM(null);
      setStatus(`Replay complete: the load rose ${liftM.toFixed(1)} metres.`);
    };
    frame.current = requestAnimationFrame(tick);
  }, [liftM, stop]);

  return {
    cancel,
    replay,
    running,
    status,
    visualLiftM: visualLiftM ?? liftM,
  };
}
