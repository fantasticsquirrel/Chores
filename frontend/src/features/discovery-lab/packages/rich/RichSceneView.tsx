import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRichScene, type RichProjectedLabel } from "./createRichScene";
import type { RasterAssets } from "./rasterAssets";
import type { RichScene } from "./parseRichScene";
import "../scene3d/scene3d.css";
export default function RichSceneView({
  scene,
  description,
  fallback,
  assets,
  onPointer,
  pointerMode,
}: {
  scene: RichScene;
  assets: RasterAssets;
  pointerMode?: "drag" | "tap";
  onPointer?: (event: {
    phase: "down" | "move" | "up";
    x: number;
    y: number;
    nodeId?: string;
    point?: number[];
    rayOrigin?: number[];
    rayDirection?: number[];
  }) => void;
  description: string;
  fallback?: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<ReturnType<typeof createRichScene> | null>(null);
  const latest = useRef(scene);
  latest.current = scene;
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
    mode?: "tap" | "drag";
  } | null>(null);
  const [labels, setLabels] = useState<RichProjectedLabel[]>([]),
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
      runtime.current = createRichScene(
        element,
        latest.current,
        assets,
        setLabels,
      );
    } catch {
      lost();
    }
    element.addEventListener("webglcontextlost", lost, true);
    return () => {
      element.removeEventListener("webglcontextlost", lost, true);
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [assets]);
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
  const pointer = (
    e: React.PointerEvent<HTMLDivElement>,
    phase: "down" | "move" | "up",
  ) => {
    if (!onPointer) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y = Math.max(0, Math.min(1, (e.clientY - box.top) / box.height));
    const hit = runtime.current?.pick(x, y);
    onPointer({
      phase,
      x,
      y,
      ...(hit
        ? {
            rayOrigin: hit.rayOrigin,
            rayDirection: hit.rayDirection,
            ...("id" in hit ? { nodeId: hit.id, point: hit.point } : {}),
          }
        : {}),
    });
  };
  const choose = (id?: string) => {
    runtime.current?.setView(id);
    setView(id ?? scene.camera.presets[0]?.id ?? null);
  };
  const colors = scene.presentation.background;
  const color = colors[1].slice(1);
  const rgb =
    color.length === 3
      ? color
          .split("")
          .map((c) => c + c)
          .join("")
      : color;
  const bright =
    0.2126 * parseInt(rgb.slice(0, 2), 16) +
      0.7152 * parseInt(rgb.slice(2, 4), 16) +
      0.0722 * parseInt(rgb.slice(4, 6), 16) >
    140;
  const foreground = bright ? "#25372e" : "#edf4ff";
  return (
    <div
      className="package-3d-visual package-rich-visual"
      style={{
        height: scene.presentation.layout?.height,
        overflow: "hidden",
        background: `radial-gradient(ellipse at 49% 47%, ${colors[0]} 0, ${colors[1]} 52%, ${colors[2]} 100%)`,
      }}
    >
      {scene.presentation.showHeading !== false && (
        <div className="package-3d-heading">
          <h2 style={{ color: foreground }}>{scene.presentation.title}</h2>
          {scene.presentation.subtitle && (
            <p style={{ color: foreground }}>{scene.presentation.subtitle}</p>
          )}
        </div>
      )}
      {scene.presentation.stat && (
        <div
          className="package-rich-stat"
          style={{
            color: foreground,
            ...(scene.presentation.stat.corner?.startsWith("bottom")
              ? { top: "auto", bottom: 90 }
              : {}),
            ...(scene.presentation.stat.corner?.endsWith("left")
              ? { right: "auto", left: 30, textAlign: "left" }
              : {}),
          }}
        >
          <strong>{scene.presentation.stat.value}</strong>
          <span>{scene.presentation.stat.label}</span>
        </div>
      )}
      {scene.presentation.route && (
        <p className="package-3d-route" style={{ color: foreground }}>
          {scene.presentation.route}
        </p>
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
            style={
              scene.presentation.layout
                ? {
                    inset: scene.presentation.layout.canvasInset
                      .map((v) => (typeof v === "number" ? `${v}px` : v))
                      .join(" "),
                  }
                : undefined
            }
            ref={host}
            role="img"
            aria-label={description}
            tabIndex={0}
            onKeyDown={(e) => {
              if (scene.camera.interactive === false) return;
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
              if (pointerMode !== "tap") pointer(e, "down");
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
                mode: pointerMode,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              if (drag.current.mode !== "tap" && pointerMode !== "tap")
                pointer(e, "move");
              drag.current.moved ||=
                Math.hypot(
                  e.clientX - drag.current.startX,
                  e.clientY - drag.current.startY,
                ) > 5;
              if (
                scene.camera.interactive !== false &&
                (!onPointer || pointerMode === "tap")
              )
                runtime.current?.orbit(
                  (drag.current.x - e.clientX) * 0.006,
                  (e.clientY - drag.current.y) * 0.005,
                );
              drag.current = { ...drag.current, x: e.clientX, y: e.clientY };
              setView(null);
            }}
            onPointerUp={(e) => {
              if (
                drag.current &&
                (drag.current.mode !== "tap" || !drag.current.moved)
              )
                pointer(e, "up");
              drag.current = null;
            }}
            onPointerCancel={(e) => {
              if (drag.current?.mode !== "tap") pointer(e, "up");
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              {labels
                .filter((l) => l.anchorX !== undefined)
                .map((l, i) => (
                  <line
                    key={i}
                    x1={l.x}
                    y1={l.y}
                    x2={l.anchorX}
                    y2={l.anchorY}
                    stroke="#ffffff"
                    strokeWidth="0.2"
                  />
                ))}
            </svg>
            {labels.map((label, i) => (
              <span
                key={i}
                className={`package-3d-annotation${label.anchorX !== undefined ? " package-rich-anchored" : ""}`}
                aria-hidden="true"
                style={{ left: `${label.x}%`, top: `${label.y}%` }}
              >
                {label.text}
              </span>
            ))}
          </div>
          {scene.camera.interactive !== false && (
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
          )}
          {(scene.presentation.gestureHint ||
            scene.camera.interactive !== false) && (
            <p className="package-3d-hint" style={{ color: foreground }}>
              {scene.presentation.gestureHint ??
                "Drag to turn · Arrow keys to orbit · + / − to zoom · Home to reset view"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
