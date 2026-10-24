import * as THREE from "three";
import type { PathGeometry } from "./pathGeometry";
export function createPathGeometry(g: PathGeometry): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (const c of g.commands) {
    const a: number[] = c.args;
    switch (c.op) {
      case "moveTo":
        shape.moveTo(a[0], a[1]);
        break;
      case "lineTo":
        shape.lineTo(a[0], a[1]);
        break;
      case "bezierCurveTo":
        shape.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
        break;
      case "quadraticCurveTo":
        shape.quadraticCurveTo(a[0], a[1], a[2], a[3]);
        break;
      case "absellipse":
        shape.absellipse(a[0], a[1], a[2], a[3], a[4], a[5], !!a[6], a[7]);
        break;
      case "closePath":
        shape.closePath();
    }
  }
  return g.kind === "shape"
    ? new THREE.ShapeGeometry(shape, g.curveSegments)
    : new THREE.ExtrudeGeometry(shape, {
        depth: g.depth,
        curveSegments: g.curveSegments,
        steps: 1,
        bevelEnabled: false,
      });
}
