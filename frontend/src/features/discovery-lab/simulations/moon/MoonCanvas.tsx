import { useEffect, useRef, useState } from "react";
import { createMoonScene } from "@family-manager/discovery-scenes/moon";
import colorUrl from "./assets/lroc-color-2k.jpg";
import heightUrl from "./assets/lola-elevation-1k.jpg";

type Props = {
  angle: number;
  onChange: (value: number) => void;
  label: string;
};
/** Demand-rendered physically lit sphere. No animation loop or remote assets. */
export function MoonCanvas({ angle, onChange, label }: Props) {
  const host = useRef<HTMLDivElement>(null),
    render = useRef<((angle: number) => void) | null>(null);
  const [available, setAvailable] = useState(true);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let scene: ReturnType<typeof createMoonScene> = null;
    const unavailable = () => {
      render.current = null;
      scene?.dispose();
      scene = null;
      setAvailable(false);
    };
    scene = createMoonScene(host.current, {
      colorUrl,
      heightUrl,
      onUnavailable: unavailable,
    });
    render.current = scene?.setAngle ?? null;
    return () => {
      render.current = null;
      scene?.dispose();
    };
  }, []);
  useEffect(() => {
    render.current?.(angle);
  }, [angle]);
  return (
    <div
      className="moon-render"
      ref={host}
      role="img"
      aria-label={
        available
          ? label
          : "Lunar surface unavailable; use the phase controls and orbit diagram."
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, angle };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onChange(
          (drag.current.angle + (event.clientX - drag.current.x) * 0.65 + 720) %
            360,
        );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {!available && (
        <div className="moon-render-fallback">
          <span>3D rendering is unavailable on this device.</span>
          <span>
            The orbit diagram and phase controls below remain available.
          </span>
        </div>
      )}
    </div>
  );
}
