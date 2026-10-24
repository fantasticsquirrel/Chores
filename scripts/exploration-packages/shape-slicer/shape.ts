import * as T from "three";
import {
  crossSection,
  rotateSolidPoint,
  solidVertices,
  solidEdges,
  type ShapeSlicerState,
} from "./model";
import type { ExpansionScene } from "./types";
import {
  disposeGroup,
  line,
  material,
  mesh,
  rod,
  v,
  ring,
  rebuild,
} from "./shared";
function solidGeometry(state: ShapeSlicerState) {
  if (state.solid === "sphere") return new T.SphereGeometry(1, 64, 40);
  if (state.solid === "cube") return new T.BoxGeometry(2, 2, 2);
  const geometry = new T.BufferGeometry(),
    points = solidVertices.tetrahedron,
    faces = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      faces.flatMap((i) => points[i]),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}
export function createShapeSlicerScene(
  initial: ShapeSlicerState,
): ExpansionScene<ShapeSlicerState> {
  const group = new T.Group();
  let state = initial;
  const draw = () =>
    rebuild(group, () => {
      const stage = mesh(
        group,
        new T.CylinderGeometry(2.9, 3, 0.16, 80),
        material("#354552"),
        0,
        -2.05,
      );
      stage.receiveShadow = true;
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        rod(
          group,
          v(Math.cos(a) * 2.7, -1.96, Math.sin(a) * 2.7),
          v(
            Math.cos(a) * (i % 5 === 0 ? 2.49 : 2.6),
            -1.96,
            Math.sin(a) * (i % 5 === 0 ? 2.49 : 2.6),
          ),
          0.009,
          "#7b9aab",
        );
      }
      ring(group, 0, -1.95, 0, 2.8, 2.8, "#aec5c9", 0.014);
      const geometry = solidGeometry(state);
      geometry.rotateX((state.tilt * Math.PI) / 180);
      geometry.rotateZ((state.turn * Math.PI) / 180);
      mesh(
        group,
        geometry,
        new T.MeshPhysicalMaterial({
          color: "#75b8d4",
          transparent: true,
          opacity: 0.18,
          roughness: 0.3,
          metalness: 0.05,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      if (state.solid !== "sphere") {
        const points = solidVertices[state.solid].map(
          (p) => new T.Vector3(...rotateSolidPoint(p, state.tilt, state.turn)),
        );
        for (const [a, b] of solidEdges[state.solid])
          rod(group, points[a], points[b], 0.012, "#bed9ed");
        for (const p of points)
          mesh(
            group,
            new T.SphereGeometry(0.027, 12, 8),
            material("#e5f2ef"),
            p.x,
            p.y,
            p.z,
          );
      } else
        for (let i = 0; i < 7; i++) {
          const yy = -0.9 + i * 0.3,
            r = Math.sqrt(1 - yy * yy);
          ring(group, 0, yy, 0, r, r, "#7ab2cb", 0.005);
        }
      const plane = mesh(
        group,
        new T.PlaneGeometry(4.3, 4.3),
        new T.MeshBasicMaterial({
          color: "#e9b869",
          transparent: true,
          opacity: 0.13,
          side: T.DoubleSide,
          depthWrite: false,
        }),
        0,
        state.offset,
      );
      plane.rotation.x = -Math.PI / 2;
      for (let i = -4; i <= 4; i++) {
        rod(
          group,
          v(-2.15, state.offset, i * 0.5),
          v(2.15, state.offset, i * 0.5),
          0.003,
          "#89785b",
        );
        rod(
          group,
          v(i * 0.5, state.offset, -2.15),
          v(i * 0.5, state.offset, 2.15),
          0.003,
          "#89785b",
        );
      }
      const section = crossSection(state);
      if (section.points.length > 2) {
        const points = section.points.map((p) => v(p[0], p[1] + 0.008, p[2]));
        const vertices: number[] = [];
        for (let i = 1; i < points.length - 1; i++)
          vertices.push(
            ...points[0].toArray(),
            ...points[i].toArray(),
            ...points[i + 1].toArray(),
          );
        const face = new T.BufferGeometry();
        face.setAttribute(
          "position",
          new T.Float32BufferAttribute(vertices, 3),
        );
        face.computeVertexNormals();
        mesh(
          group,
          face,
          new T.MeshStandardMaterial({
            color: "#efbd65",
            side: T.DoubleSide,
            transparent: true,
            opacity: 0.82,
            roughness: 0.6,
          }),
        );
        points.forEach((p, i) =>
          rod(group, p, points[(i + 1) % points.length], 0.018, "#fff0b4"),
        );
      } else if (section.points.length === 1) {
        const p = section.points[0];
        mesh(
          group,
          new T.SphereGeometry(0.04, 16, 10),
          material("#fff2b4"),
          ...p,
        );
      } else if (section.points.length === 2)
        line(
          group,
          section.points.map((p) => new T.Vector3(...p)),
          "#ffe6a0",
          0.025,
        );
      rod(group, v(2.55, -1.8, 0), v(2.55, 1.8, 0), 0.025, "#9bafbc");
      for (let i = -7; i <= 7; i++)
        rod(
          group,
          v(2.45, i * 0.25, 0),
          v(2.65 + (i % 2 === 0 ? 0.1 : 0), i * 0.25, 0),
          0.009,
          "#cbd8d8",
        );
      const marker = mesh(
        group,
        new T.BoxGeometry(0.38, 0.08, 0.2),
        material("#efbd65"),
        2.55,
        state.offset,
        0,
      );
      marker.userData.control = 0;
      for (const direction of [-1, 1]) {
        const handle = mesh(
          group,
          new T.ConeGeometry(0.12, 0.22, 12),
          material("#ffdc8a"),
          2.55,
          state.offset + direction * 0.3,
          0,
        );
        if (direction < 0) handle.rotation.z = Math.PI;
        handle.userData.control = direction > 0 ? 1 : -1;
      }
    });
  draw();
  return {
    group,
    view: {
      position: [6, 5.2, 7],
      target: [0, -0.3, 0],
      width: 7.2,
      height: 6.2,
    },
    update(next) {
      state = next;
      draw();
    },
    labels: () => [
      {
        text: `Cut height ${state.offset.toFixed(2)}`,
        at: [2.55, state.offset, 0],
      },
      { text: crossSection(state).name, at: [-1.4, state.offset + 0.12, 1.6] },
    ],
    pick(ray) {
      const hit = ray
        .intersectObject(group, true)
        .find((item) => typeof item.object.userData.control === "number");
      return hit ? Number(hit.object.userData.control) : null;
    },
    dispose() {
      disposeGroup(group);
    },
  };
}
