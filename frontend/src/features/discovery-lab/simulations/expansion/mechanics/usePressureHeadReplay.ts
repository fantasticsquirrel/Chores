import { useCallback, useEffect, useRef, useState } from "react";

export function usePressureHeadReplay(surfaceM: number, outletM: number) {
  const frame = useRef<number | null>(null);
  const [visualSurfaceM, setVisualSurfaceM] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setRunning(false);
    setVisualSurfaceM(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus("");
  }, [stop]);

  useEffect(() => cancel(), [surfaceM, outletM, cancel]);
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
    const headM = surfaceM - outletM;
    if (headM <= 0) {
      setStatus("Put the outlet below the water surface before replaying.");
      return;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setStatus(
        "Reduced motion is on; the final water level and pressure stay shown.",
      );
      return;
    }
    const start = performance.now();
    const firstSurfaceM = Math.max(0.2, outletM);
    setRunning(true);
    setStatus(
      "Replaying the water surface rising while the outlet stays fixed.",
    );
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setVisualSurfaceM(firstSurfaceM + (surfaceM - firstSurfaceM) * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setVisualSurfaceM(null);
      setStatus(
        `Replay complete: the surface is ${surfaceM.toFixed(1)} m and head is ${headM.toFixed(1)} m.`,
      );
    };
    frame.current = requestAnimationFrame(tick);
  }, [outletM, stop, surfaceM]);

  return {
    cancel,
    replay,
    running,
    status,
    visualSurfaceM: visualSurfaceM ?? surfaceM,
  };
}
