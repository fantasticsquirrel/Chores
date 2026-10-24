import { describe, it, expect } from "vitest";
import * as T from "three";
import { serializeScene, serializeExpansionScene } from "./serialize-scene";
import { parseRichScene } from "../../../frontend/src/features/discovery-lab/packages/rich/parseRichScene";
const presentation = {
  title: "Test model",
  background: ["#ffffff", "#eeeeee", "#dddddd"] as [string, string, string],
};
const camera = () => {
  const c = new T.OrthographicCamera(-8, 8, 6, -6, 0.1, 500);
  c.position.set(10, 10, 10);
  c.lookAt(0, 0, 0);
  return c;
};
const render = (root: T.Object3D) =>
  serializeScene(root, camera(), { target: [0, 0, 0], presentation });
describe("independent rich scene serialization", () => {
  it("deduplicates equivalent resources and preserves quaternion orientation", () => {
    const g = new T.Group();
    for (let i = 0; i < 2; i++) {
      const m = new T.Mesh(
        new T.BoxGeometry(1, 2, 3),
        new T.MeshStandardMaterial({ color: 0xcc8844 }),
      );
      m.quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), 0.7);
      g.add(m);
    }
    const output = render(g);
    expect(output.geometries).toHaveLength(1);
    expect(output.materials).toHaveLength(1);
    expect(output.nodes[0].children?.[0].rotation?.[1]).toBeCloseTo(0.7);
    expect(parseRichScene(output)).not.toBeNull();
  });
  it("preserves draw range and converts material groups", () => {
    const g = new T.Group();
    const box = new T.Mesh(
      new T.BoxGeometry(),
      Array.from(
        { length: 6 },
        (_, i) => new T.MeshBasicMaterial({ color: i }),
      ),
    );
    g.add(box);
    const path = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(1, 0, 0),
      new T.Vector3(2, 0, 0),
    ]);
    path.setDrawRange(0, 2);
    g.add(new T.Line(path, new T.LineBasicMaterial()));
    const output = render(g);
    expect(output.nodes[0].children?.[0].children).toHaveLength(6);
    const last = output.geometries.at(-1);
    expect(last?.kind).toBe("buffer");
    if (last?.kind === "buffer") expect(last.indices).toEqual([0, 1]);
    expect(parseRichScene(output)).not.toBeNull();
  });
  it("requires explicit package texture assets", () => {
    const texture = new T.Texture();
    const g = new T.Mesh(
      new T.BoxGeometry(),
      new T.MeshBasicMaterial({ map: texture }),
    );
    expect(() => render(g)).toThrow("packageAsset");
    texture.userData.packageAsset = {
      asset: "assets/art.png",
      width: 32,
      height: 32,
    };
    const output = render(g);
    expect(parseRichScene(output, new Set(["assets/art.png"]))).not.toBeNull();
    expect(parseRichScene(output)).toBeNull();
  });
  it("preserves line segments, points, and hidden zero-size objects", () => {
    const root = new T.Group();
    const geometry = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(1, 0, 0),
    ]);
    root.add(new T.LineSegments(geometry, new T.LineBasicMaterial()));
    root.add(new T.Points(geometry, new T.PointsMaterial({ size: 0.2 })));
    const hidden = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
    hidden.scale.setScalar(0);
    root.add(hidden);
    const output = render(root);
    expect(output.nodes[0].children?.map((c) => c.kind)).toEqual([
      "segments",
      "points",
      "mesh",
    ]);
    expect(output.nodes[0].children?.[2].visible).toBe(false);
    expect(parseRichScene(output)).not.toBeNull();
  });
  it("serializes expansion view and labels", () => {
    const group = new T.Group();
    group.add(
      new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial()),
    );
    const output = serializeExpansionScene(
      {
        group,
        view: {
          position: [10, 10, 10],
          target: [0, 0, 0],
          width: 16,
          height: 12,
        },
        labels: () => [{ text: "Sphere", at: [0, 1, 0] }],
      },
      presentation,
    );
    expect(output.labels[0].position).toEqual([0, 1, 0]);
    expect(parseRichScene(output)).not.toBeNull();
  });
  it("preserves full-resolution extrusion curves without transferring expanded buffers", () => {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.absarc(0, 0, 1, 0, Math.PI / 12, false);
    shape.lineTo(0, 0);
    const original = new T.ExtrudeGeometry(shape, {
      depth: 0.13,
      bevelEnabled: false,
      curveSegments: 64,
    });
    const output = render(new T.Mesh(original, new T.MeshStandardMaterial()));
    const geometry = output.geometries[0];
    expect(geometry.kind).toBe("extrude");
    expect(parseRichScene(output)).not.toBeNull();
    if (geometry.kind !== "extrude")
      throw Error("Expected parametric extrusion");
    expect(geometry.curveSegments).toBe(64);
    const restored = new T.Shape();
    for (const command of geometry.commands) {
      switch (command.op) {
        case "moveTo":
          restored.moveTo(...command.args);
          break;
        case "lineTo":
          restored.lineTo(...command.args);
          break;
        case "absellipse": {
          const [x, y, rx, ry, start, end, clockwise, rotation] = command.args;
          restored.absellipse(
            x,
            y,
            rx,
            ry,
            start,
            end,
            clockwise === 1,
            rotation,
          );
          break;
        }
        case "bezierCurveTo":
          restored.bezierCurveTo(...command.args);
          break;
        case "quadraticCurveTo":
          restored.quadraticCurveTo(...command.args);
          break;
        case "closePath":
          restored.closePath();
          break;
      }
    }
    const rebuilt = new T.ExtrudeGeometry(restored, {
      depth: geometry.depth,
      bevelEnabled: false,
      curveSegments: geometry.curveSegments,
      steps: 1,
    });
    for (const name of ["position", "normal", "uv"])
      expect(Array.from(rebuilt.getAttribute(name).array)).toEqual(
        Array.from(original.getAttribute(name).array),
      );
    expect(JSON.stringify(output).length).toBeLessThan(5000);
  });
  it("does not replace modified parametric geometry with an unmodified primitive", () => {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(0, 1);
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: 0.2,
      bevelEnabled: false,
    });
    geometry.translate(3, 2, 1);
    const output = render(new T.Mesh(geometry, new T.MeshStandardMaterial()));
    expect(output.geometries[0].kind).toBe("buffer");
    expect(parseRichScene(output)).not.toBeNull();
  });
});
