/* eslint-disable react-refresh/only-export-components -- Shared import surface includes the pure vector validator. */
import { createElement, useId, useRef } from "react";
import type { RichVector, RichVectorNode } from "./vectorModel";
export { parseRichVector } from "./vectorModel";
export type { RichVector, RichVectorNode } from "./vectorModel";
export type VectorPointer = {
  phase: "down" | "move" | "up";
  x: number;
  y: number;
};
export function RichVectorView({
  scene,
  onPointer,
}: {
  scene: RichVector;
  onPointer?: (event: VectorPointer) => void;
}) {
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "") + "v",
    drag = useRef(false);
  const render = (
    n: RichVectorNode | string,
    index: number,
  ): React.ReactNode => {
    if (typeof n === "string") return n;
    const attrs: Record<string, string | number> = { ...n.attrs };
    for (const k of ["fill", "stroke", "clipPath", "filter"])
      if (typeof attrs[k] === "string" && attrs[k].startsWith("url(#"))
        attrs[k] = `url(#${prefix}-${attrs[k].slice(5, -1)})`;
    if (attrs.id) attrs.id = `${prefix}-${attrs.id}`;
    return createElement(
      n.tag,
      { ...attrs, key: index },
      ...n.children.map(render),
    );
  };
  const pointer = (
    event: React.PointerEvent<SVGSVGElement>,
    phase: VectorPointer["phase"],
  ) => {
    if (!scene.pointer || !onPointer) return;
    if (phase === "down") {
      if (event.button !== 0) return;
      drag.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!drag.current) return;
    const b = event.currentTarget.getBoundingClientRect();
    const aspect = scene.viewBox[2] / scene.viewBox[3],
      w = Math.min(b.width, b.height * aspect),
      h = w / aspect;
    onPointer({
      phase,
      x: Math.max(
        0,
        Math.min(1, (event.clientX - b.left - (b.width - w) / 2) / w),
      ),
      y: Math.max(
        0,
        Math.min(1, (event.clientY - b.top - (b.height - h) / 2) / h),
      ),
    });
    if (phase === "up") drag.current = false;
  };
  return (
    <svg
      viewBox={scene.viewBox.join(" ")}
      role="img"
      aria-label={scene.description}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        touchAction: scene.pointer ? "none" : "auto",
      }}
      onPointerDown={(e) => pointer(e, "down")}
      onPointerMove={(e) => pointer(e, "move")}
      onPointerUp={(e) => pointer(e, "up")}
      onPointerCancel={(e) => pointer(e, "up")}
    >
      {scene.nodes.map(render)}
    </svg>
  );
}
