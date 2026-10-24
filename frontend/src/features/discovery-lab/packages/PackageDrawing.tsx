import { lazy, Suspense, useState, type ReactNode } from "react";
import type { Scene } from "./bridge";
import type { RasterAssets } from "./rich/rasterAssets";
import { RichVectorView } from "./rich/vector";
import "./rich/rich.css";
const RichSceneView = lazy(() => import("./rich/RichSceneView"));
const Scene3DView = lazy(() => import("./scene3d/Scene3DView"));
export type PointerInput = {
  phase: "down" | "move" | "up";
  x: number;
  y: number;
  nodeId?: string;
  point?: number[];
  rayOrigin?: number[];
  rayDirection?: number[];
};
export function DiagramViewport({ children }: { children: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <div
      className={`discovery-package-diagram${enlarged ? " is-enlarged" : ""}`}
    >
      <button
        type="button"
        aria-pressed={enlarged}
        onClick={() => setEnlarged(!enlarged)}
      >
        {enlarged ? "Fit diagram" : "Enlarge diagram"}
      </button>
      {enlarged && <p>Scroll horizontally to inspect the full diagram.</p>}
      <div
        role="region"
        aria-label="Simulation diagram"
        tabIndex={enlarged ? 0 : undefined}
        style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}
      >
        <div style={{ minWidth: enlarged ? "800px" : 0 }}>{children}</div>
      </div>
    </div>
  );
}

export function Drawing({
  scene,
  assets,
  onPointer,
}: {
  scene: Scene;
  assets: RasterAssets;
  onPointer: (event: PointerInput) => void;
}) {
  if (scene.rich3d || scene.vector)
    return (
      <>
        <div style={{ position: "relative" }}>
          {scene.rich3d && (
            <Suspense fallback={<p>Loading 3D view…</p>}>
              <RichSceneView
                scene={scene.rich3d}
                assets={assets}
                description={scene.description}
                onPointer={scene.pointer ? onPointer : undefined}
                pointerMode={scene.pointerMode}
                fallback={
                  scene.fallbackVector ? (
                    <RichVectorView scene={scene.fallbackVector} />
                  ) : undefined
                }
              />
            </Suspense>
          )}
          {scene.rich3d && scene.vector?.inset && (
            <div
              style={{
                position: "absolute",
                width: `min(40%, ${scene.vector.inset.width}px)`,
                [scene.vector.inset.corner.startsWith("top")
                  ? "top"
                  : "bottom"]: scene.vector.inset.corner.startsWith("top")
                  ? 27
                  : 45,
                [scene.vector.inset.corner.endsWith("right")
                  ? "right"
                  : "left"]: 24,
                zIndex: 3,
              }}
            >
              <RichVectorView scene={scene.vector} onPointer={onPointer} />
            </div>
          )}
        </div>
        {scene.vector && (!scene.rich3d || !scene.vector.inset) && (
          <DiagramViewport>
            <RichVectorView scene={scene.vector} onPointer={onPointer} />
          </DiagramViewport>
        )}
        {!scene.vector && scene.shapes.length > 0 && (
          <LegacyDrawing scene={scene} showDescription={false} />
        )}
        {!!scene.readouts?.length && (
          <dl
            className="package-rich-readouts"
            style={
              scene.readoutColumns
                ? {
                    gridTemplateColumns: `repeat(${scene.readoutColumns},minmax(0,1fr))`,
                  }
                : undefined
            }
          >
            {scene.readouts.map((r, i) => (
              <div key={i}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
                {r.detail && (
                  <dd className="package-rich-readout-detail">{r.detail}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
        <p className="discovery-package-evidence">{scene.description}</p>
      </>
    );
  if (scene.scene3d)
    return (
      <>
        <Suspense fallback={<p>Loading 3D view…</p>}>
          <Scene3DView
            scene={scene.scene3d}
            description={scene.description}
            fallback={
              scene.fallbackVector ? (
                <RichVectorView scene={scene.fallbackVector} />
              ) : undefined
            }
          />
        </Suspense>
        <p className="discovery-package-evidence">{scene.description}</p>
      </>
    );
  return <LegacyDrawing scene={scene} />;
}
function LegacyDrawing({
  scene,
  showDescription = true,
}: {
  scene: Scene;
  showDescription?: boolean;
}) {
  return (
    <>
      <DiagramViewport>
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={scene.description}
          className="discovery-package-canvas"
        >
          {scene.shapes.map((p, i) =>
            p.kind === "circle" ? (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.fill ?? "#6354b8"}
              />
            ) : p.kind === "rect" ? (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={p.fill ?? "#6354b8"}
              />
            ) : p.kind === "line" ? (
              <line
                key={i}
                x1={p.x}
                y1={p.y}
                x2={p.x2}
                y2={p.y2}
                stroke={p.stroke ?? "#6354b8"}
                strokeWidth={p.width ?? 2}
              />
            ) : (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fill={p.fill ?? "#27233f"}
                fontSize={p.size ?? 16}
              >
                {p.text}
              </text>
            ),
          )}
        </svg>
      </DiagramViewport>
      {showDescription && (
        <p className="discovery-package-evidence">{scene.description}</p>
      )}
    </>
  );
}
