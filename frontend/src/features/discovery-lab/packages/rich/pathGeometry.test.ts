import { it, expect } from "vitest";
import { parseRichScene, geometryTriangles } from "./parseRichScene";
import { createPathGeometry } from "./createPathGeometry";
import { richFixture } from "./testFixture";
const geometry = {
  id: "g0",
  kind: "extrude",
  depth: 0.2,
  curveSegments: 64,
  commands: [
    { op: "moveTo", args: [0, 0] },
    { op: "lineTo", args: [1, 0] },
    { op: "absellipse", args: [0, 0, 1, 1, 0, Math.PI / 12, 0, 0] },
    { op: "closePath", args: [] },
  ],
};
it("preserves bounded original64-segment sector extrusions and accounts for generated triangles", () => {
  const scene = parseRichScene({ ...richFixture(), geometries: [geometry] })!;
  expect(scene).not.toBeNull();
  const g = scene.geometries[0];
  if (g.kind !== "extrude") throw Error("wrong kind");
  const result = createPathGeometry(g);
  expect(result.getAttribute("position").count / 3).toBeLessThanOrEqual(
    geometryTriangles(g),
  );
  result.dispose();
});
it("rejects arbitrary shape methods, holes, bevels, path growth and aggregate triangle explosions", () => {
  for (const patch of [
    { commands: [{ op: "eval", args: [] }] },
    { holes: [] },
    { bevelEnabled: true },
    { curveSegments: 100000 },
    {
      commands: [
        { op: "moveTo", args: [0, 0] },
        { op: "moveTo", args: [1, 1] },
      ],
    },
    {
      commands: [
        { op: "moveTo", args: [0, 0] },
        ...Array(30).fill({
          op: "absellipse",
          args: [0, 0, 1, 1, 0, Math.PI * 2, 0, 0],
        }),
      ],
    },
  ])
    expect(
      parseRichScene({
        ...richFixture(),
        geometries: [{ ...geometry, ...patch }],
      }),
    ).toBeNull();
  const s = richFixture();
  expect(
    parseRichScene({
      ...s,
      geometries: [geometry],
      nodes: Array(1000).fill(s.nodes[0]),
    }),
  ).toBeNull();
});
