import { useEffect, useRef, useState } from "react";
import { createSpaceScene } from "./createSpaceScene";
import { buildOrbitScene, type OrbitSceneState } from "./orbitScene";
import { buildSolarScene, type SolarSceneState } from "./solarScene";
import { buildGravityScene, type GravitySceneState } from "./gravityScene";
import earthUrl from "./assets/nasa-blue-marble-2k.jpg";

type Props = {
  label: string;
  progress: number;
  onProgress: (value: number) => void;
} & (
  | { kind: "orbit"; state: OrbitSceneState }
  | { kind: "solar"; state: SolarSceneState }
  | { kind: "gravity"; state: GravitySceneState }
);
export function SpaceCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    update = useRef<((state: Props["state"]) => void) | null>(null);
  const [available, setAvailable] = useState(true);
  const drag = useRef<{ x: number; progress: number } | null>(null);
  const kind = props.kind;
  useEffect(() => {
    if (!host.current) return;
    const unavailable = () => setAvailable(false);
    const context =
      kind === "orbit"
        ? createSpaceScene(
            host.current,
            (c) => buildOrbitScene(c, earthUrl),
            unavailable,
          )
        : kind === "solar"
          ? createSpaceScene(
              host.current,
              (c) => buildSolarScene(c, earthUrl),
              unavailable,
            )
          : createSpaceScene(host.current, buildGravityScene, unavailable);
    update.current = context?.update as
      | ((state: Props["state"]) => void)
      | null;
    return () => {
      update.current = null;
      context?.dispose();
    };
  }, [kind]);
  useEffect(() => {
    update.current?.(props.state);
  }, [props.state]);
  return (
    <div
      ref={host}
      className={`space-render space-render-${kind}`}
      role="img"
      aria-label={props.label}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, progress: props.progress };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const width = event.currentTarget.getBoundingClientRect().width;
        props.onProgress(
          Math.max(
            0,
            Math.min(
              0.9999,
              drag.current.progress +
                (event.clientX - drag.current.x) / Math.max(200, width),
            ),
          ),
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
        <div className="space-render-fallback">
          <strong>3D view unavailable</strong>
          <p>{props.label}</p>
          <span>Use the controls below to compare the calculated results.</span>
        </div>
      )}
    </div>
  );
}
