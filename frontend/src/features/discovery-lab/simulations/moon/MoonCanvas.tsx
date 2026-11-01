import { useEffect, useRef, useState } from "react";
import {
  createMoonScene,
  type MoonSceneView,
} from "@family-manager/discovery-scenes/moon";
import earthUrl from "../space/assets/nasa-blue-marble-2k.jpg";
import colorUrl from "./assets/lroc-color-2k.jpg";
import heightUrl from "./assets/lola-elevation-1k.jpg";

type Props = {
  angle: number;
  view: MoonSceneView;
  onChange: (value: number) => void;
  label: string;
};
/** Demand-rendered physically lit sphere. No animation loop or remote assets. */
export function MoonCanvas({ angle, view, onChange, label }: Props) {
  const host = useRef<HTMLDivElement>(null),
    render = useRef<
      ((state: { angle: number; view: MoonSceneView }) => void) | null
    >(null);
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
      earthUrl,
      onUnavailable: unavailable,
    });
    render.current = scene?.setState ?? null;
    return () => {
      render.current = null;
      scene?.dispose();
    };
  }, []);
  useEffect(() => {
    render.current?.({ angle, view });
  }, [angle, view]);
  return (
    <div
      className={`moon-render moon-render--${view}`}
      ref={host}
      role="img"
      aria-label={
        available
          ? label
          : "Lunar surface unavailable; use the phase controls and orbit diagram."
      }
      onPointerDown={(event) => {
        if (view !== "earth") return;
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, angle };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || view !== "earth") return;
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
          <strong>3D view unavailable</strong>
          <span>The phase evidence and controls still work.</span>
        </div>
      )}
    </div>
  );
}
