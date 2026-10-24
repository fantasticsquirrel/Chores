import { useEffect, useRef, useState } from "react";
import {
  createLandscapeScene,
  type LandscapeScene,
  type ProjectedLabel,
} from "@family-manager/discovery-scenes/landscape/createLandscapeScene";
import type { LandscapeState } from "@family-manager/discovery-scenes/landscape/state";
export function LandscapeCanvas({
  state,
  description,
  onSelect,
}: {
  state: LandscapeState;
  description: string;
  onSelect?: (index: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<LandscapeScene | null>(null),
    drag = useRef<{
      x: number;
      y: number;
      startX: number;
      startY: number;
      moved: boolean;
    } | null>(null);
  const [available, setAvailable] = useState(
      typeof WebGLRenderingContext !== "undefined",
    ),
    [labels, setLabels] = useState<ProjectedLabel[]>([]),
    [above, setAbove] = useState(false);
  useEffect(() => {
    if (!host.current || typeof WebGLRenderingContext === "undefined") return;
    try {
      scene.current = createLandscapeScene(
        host.current,
        state.kind,
        setLabels,
        () => setAvailable(false),
      );
    } catch {
      setAvailable(false);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, [state.kind]);
  useEffect(() => {
    scene.current?.setState(state);
  }, [state]);
  const view = (value: boolean) => {
    setAbove(value);
    scene.current?.setView(value);
  };
  return (
    <>
      <div
        className="landscape-canvas"
        ref={host}
        tabIndex={available ? 0 : -1}
        role="img"
        aria-label={`${description} Drag or use arrow keys to turn; plus and minus to zoom.`}
        onKeyDown={(event) => {
          const keys: Record<string, [number, number]> = {
            ArrowLeft: [-0.15, 0],
            ArrowRight: [0.15, 0],
            ArrowUp: [0, 0.1],
            ArrowDown: [0, -0.1],
          };
          if (keys[event.key]) {
            event.preventDefault();
            scene.current?.orbit(...keys[event.key]);
          }
          if (["+", "=", "-"].includes(event.key)) {
            event.preventDefault();
            scene.current?.zoomBy(event.key === "-" ? 0.9 : 1.1);
          }
          if (event.key === "Home") {
            event.preventDefault();
            view(false);
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          if (
            Math.hypot(
              event.clientX - drag.current.startX,
              event.clientY - drag.current.startY,
            ) > 6
          )
            drag.current.moved = true;
          if (drag.current.moved)
            scene.current?.orbit(
              (drag.current.x - event.clientX) * 0.005,
              (event.clientY - drag.current.y) * 0.005,
            );
          drag.current.x = event.clientX;
          drag.current.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (drag.current && !drag.current.moved) {
            const selected = scene.current?.pick(event.clientX, event.clientY);
            if (selected !== null && selected !== undefined)
              onSelect?.(selected);
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {available ? (
          labels.map((label) => (
            <span
              key={label.text}
              className="landscape-label"
              aria-hidden="true"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
            >
              {label.text}
            </span>
          ))
        ) : (
          <div className="landscape-unavailable">
            <p>3D view unavailable on this device.</p>
            <p>The controls and calculated results below remain available.</p>
          </div>
        )}
      </div>
      {available && (
        <div className="landscape-camera">
          <div>
            <button
              type="button"
              aria-pressed={!above}
              onClick={() => view(false)}
            >
              Oblique view
            </button>
            <button
              type="button"
              aria-pressed={above}
              onClick={() => view(true)}
            >
              Above
            </button>
          </div>
          <span>Drag to turn · Arrow keys · + / − zoom</span>
          <div>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => scene.current?.zoomBy(0.9)}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => scene.current?.zoomBy(1.1)}
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
}
