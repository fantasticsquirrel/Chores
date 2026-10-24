import { useEffect, useRef, useState } from "react";
import { CastleDrawing } from "../CastleDrawing";
import { Scene } from "../SimulationPrimitives";
import {
  createCastleScene,
  type CastleLabel,
  type CastleScene,
  type CastleView,
} from "./createCastleScene";
import type { CastleState } from "./castleState";
export function CastleCanvas({
  state,
  description,
}: {
  state: CastleState;
  description: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<CastleScene | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [available, setAvailable] = useState(
      typeof WebGLRenderingContext !== "undefined",
    ),
    [labels, setLabels] = useState<CastleLabel[]>([]);
  const [view, setView] = useState<CastleView | null>("courtyard");
  useEffect(() => {
    if (!host.current || typeof WebGLRenderingContext === "undefined") {
      setAvailable(false);
      return;
    }
    try {
      scene.current = createCastleScene(host.current, setLabels);
    } catch {
      setAvailable(false);
      return;
    }
    const element = host.current;
    const contextLost = () => {
      scene.current?.dispose();
      scene.current = null;
      setAvailable(false);
    };
    element.addEventListener("webglcontextlost", contextLost, true);
    return () => {
      element.removeEventListener("webglcontextlost", contextLost, true);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.setState(state);
  }, [state]);
  const chooseView = (value: CastleView) => {
    scene.current?.setView(value);
    setView(value);
  };
  return (
    <>
      <div
        className="castle-canvas"
        ref={host}
        role={available ? "img" : undefined}
        aria-label={available ? description : undefined}
        tabIndex={available ? 0 : -1}
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
            setView(null);
          }
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            scene.current?.zoomBy(1.1);
          }
          if (event.key === "-") {
            event.preventDefault();
            scene.current?.zoomBy(0.9);
          }
          if (event.key === "Home") {
            event.preventDefault();
            chooseView("courtyard");
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          scene.current?.orbit(
            (drag.current.x - event.clientX) * 0.006,
            (event.clientY - drag.current.y) * 0.005,
          );
          drag.current = { x: event.clientX, y: event.clientY };
          setView(null);
        }}
        onPointerUp={() => {
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
              className="castle-annotation"
              aria-hidden="true"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
            >
              {label.text}
            </span>
          ))
        ) : (
          <div className="castle-fallback">
            <p>
              3D view unavailable. The plan below shows the same controls and
              route.
            </p>
            <Scene
              title="Castle plan"
              description={description}
              environment="landscape"
            >
              <CastleDrawing {...state} />
            </Scene>
          </div>
        )}
      </div>
      {available && (
        <div className="castle-camera" aria-label="Castle camera">
          <div>
            {(
              [
                ["courtyard", "Courtyard"],
                ["entrance", "Entrance"],
                ["north", "North wall"],
                ["overhead", "Above"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => chooseView(value)}
              >
                {text}
              </button>
            ))}
          </div>
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
      <p className="castle-camera-hint">
        Drag to turn · Arrow keys to orbit · + / − to zoom · Home to reset view
      </p>
    </>
  );
}
