import { describe, it, expect } from "vitest";
import { parseRichScene } from "./parseRichScene";
import { richFixture } from "./testFixture";
describe("rich package resources", () => {
  it("accepts shared bounded geometry and rejects it in invalid forms", () => {
    expect(parseRichScene(richFixture())).not.toBeNull();
    for (const patch of [
      { indices: [0, 1, 3] },
      { positions: [0, 0, Infinity] },
      { normals: [1, 0, 0] },
      { colors: [2, 0, 0, 0, 1, 0, 0, 0, 1] },
      { url: "https://bad.invalid" },
    ])
      expect(
        parseRichScene({
          ...richFixture(),
          geometries: [{ ...richFixture().geometries[0], ...patch }],
        }),
      ).toBeNull();
  });
  it("rejects dangling resources, duplicated IDs and executable material hooks", () => {
    const s = richFixture();
    expect(
      parseRichScene({ ...s, nodes: [{ ...s.nodes[0], geometry: "absent" }] }),
    ).toBeNull();
    expect(
      parseRichScene({ ...s, geometries: [...s.geometries, ...s.geometries] }),
    ).toBeNull();
    expect(
      parseRichScene({
        ...s,
        materials: [{ ...s.materials[0], onBeforeCompile: "evil" }],
      }),
    ).toBeNull();
  });
  it("accepts only declared local raster textures", () => {
    const texture = {
      id: "t0",
      asset: "assets/moon.jpg",
      width: 2048,
      height: 1024,
      repeat: [1, 1],
      anisotropy: 4,
    };
    expect(
      parseRichScene(
        { ...richFixture(), textures: [texture] },
        new Set(["assets/moon.jpg"]),
      ),
    ).not.toBeNull();
    for (const asset of [
      "https://x.invalid/a.jpg",
      "../moon.jpg",
      "assets/missing.jpg",
      "data:image/svg+xml,foo",
    ])
      expect(
        parseRichScene(
          { ...richFixture(), textures: [{ ...texture, asset }] },
          new Set(["assets/moon.jpg"]),
        ),
      ).toBeNull();
  });
});
it("accepts bounded analytic sphere but rejects subdivision and angle explosions", () => {
  const s = richFixture();
  const sphere = {
    id: "g0",
    kind: "sphere",
    args: [1.24, 128, 96, 0, Math.PI * 2, 0, Math.PI],
  };
  expect(parseRichScene({ ...s, geometries: [sphere] })).not.toBeNull();
  expect(
    parseRichScene({
      ...s,
      geometries: [{ ...sphere, args: [1, 4096, 4096, 0, 7, 0, 4] }],
    }),
  ).toBeNull();
});
