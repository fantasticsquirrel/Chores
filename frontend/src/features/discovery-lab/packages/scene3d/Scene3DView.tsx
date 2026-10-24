import { useEffect, useRef, useState, type ReactNode } from "react";
import { createScene3D, type ProjectedLabel } from "./createScene3D";
import type { Scene3D } from "./types";
import "./scene3d.css";
export default function Scene3DView({
  scene,
  description,
  fallback,
}: {
  scene: Scene3D;
  description: string;
  fallback?: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<ReturnType<typeof createScene3D> | null>(null);
  const latest = useRef(scene);
  latest.current = scene;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [labels, setLabels] = useState<ProjectedLabel[]>([]),
    [error, setError] = useState(""),
    [view, setView] = useState<string | null>(
      scene.camera.presets[0]?.id ?? null,
    );
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const lost = () => {
      runtime.current?.dispose();
      runtime.current = null;
      setError(
        "3D view unavailable. The description below reports the current experiment.",
      );
    };
    try {
      runtime.current = createScene3D(element, latest.current, setLabels);
    } catch {
      lost();
    }
    element.addEventListener("webglcontextlost", lost, true);
    return () => {
      element.removeEventListener("webglcontextlost", lost, true);
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      runtime.current?.update(scene);
    } catch {
      runtime.current?.dispose();
      runtime.current = null;
      setError(
        "3D view stopped. The description below reports the current experiment.",
      );
    }
  }, [scene]);
  const choose = (id?: string) => {
    runtime.current?.setView(id);
    setView(id ?? scene.camera.presets[0]?.id ?? null);
  };
  const colors = scene.presentation.background;
  return (
    <div
      className="package-3d-visual"
      style={{
        background: `radial-gradient(ellipse at 49% 47%, ${colors[0]} 0, ${colors[1]} 52%, ${colors[2]} 100%)`,
      }}
    >
      <div className="package-3d-heading">
        <h2>{scene.presentation.title}</h2>
        {scene.presentation.subtitle && <p>{scene.presentation.subtitle}</p>}
      </div>
      {scene.presentation.route && (
        <p className="package-3d-route">{scene.presentation.route}</p>
      )}
      {error ? (
        <>
          <p role="alert" className="package-3d-error">
            {error}
          </p>
          {fallback}
        </>
      ) : (
        <>
          <div
            className="package-3d-canvas"
            ref={host}
            role="img"
            aria-label={description}
            tabIndex={0}
            onKeyDown={(e) => {
              const directions: Record<string, [number, number]> = {
                ArrowLeft: [-0.15, 0],
                ArrowRight: [0.15, 0],
                ArrowUp: [0, 0.1],
                ArrowDown: [0, -0.1],
              };
              if (directions[e.key]) {
                e.preventDefault();
                runtime.current?.orbit(...directions[e.key]);
                setView(null);
              }
              if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                runtime.current?.zoomBy(1.1);
              }
              if (e.key === "-") {
                e.preventDefault();
                runtime.current?.zoomBy(0.9);
              }
              if (e.key === "Home") {
                e.preventDefault();
                choose();
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              runtime.current?.orbit(
                (drag.current.x - e.clientX) * 0.006,
                (e.clientY - drag.current.y) * 0.005,
              );
              drag.current = { x: e.clientX, y: e.clientY };
              setView(null);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            {labels.map((label, i) => (
              <span
                key={i}
                className="package-3d-annotation"
                aria-hidden="true"
                style={{ left: `${label.x}%`, top: `${label.y}%` }}
              >
                {label.text}
              </span>
            ))}
          </div>
          <div className="package-3d-camera" aria-label="3D camera">
            <div>
              {scene.camera.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={view === p.id}
                  onClick={() => choose(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => runtime.current?.zoomBy(0.9)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => runtime.current?.zoomBy(1.1)}
              >
                +
              </button>
            </div>
          </div>
          <p className="package-3d-hint">
            Drag to turn · Arrow keys to orbit · + / − to zoom · Home to reset
            view
          </p>
        </>
      )}
    </div>
  );
}
