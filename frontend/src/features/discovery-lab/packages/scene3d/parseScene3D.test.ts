import { describe, expect, it } from "vitest";
import { parseScene3D } from "./parseScene3D";
export const fixture3D = () => ({
  materials: [{ id: "stone", kind: "standard", color: 0xaaaaaa }],
  textures: [],
  nodes: [
    {
      kind: "mesh",
      material: "stone",
      geometry: { kind: "box", args: [1, 1, 1] },
    },
  ],
  camera: {
    target: [0, 0, 0],
    radius: 80,
    yaw: 0.62,
    elevation: 0.7,
    zoom: 1,
    halfHeight: 21.5,
    narrowHalfWidth: 28,
    narrowAspect: 1.25,
    presets: [],
  },
  lighting: {
    hemisphere: { sky: 0xffffff, ground: 0x333333, intensity: 2 },
    directional: [],
  },
  labels: [],
  presentation: {
    title: "Compare walls",
    background: ["#e7e8db", "#d5d9c9", "#b7c0ad"],
  },
});
describe("bounded declarative 3D contract", () => {
  it("accepts geometry but never executable or network-bearing properties", () => {
    expect(parseScene3D(fixture3D())).not.toBeNull();
    for (const extra of [
      { url: "https://example.com" },
      { onBeforeCompile: "evil" },
      { userData: {} },
    ])
      expect(parseScene3D({ ...fixture3D(), ...extra })).toBeNull();
    expect(
      parseScene3D({
        ...fixture3D(),
        textures: [{ url: "https://example.com" }],
      }),
    ).toBeNull();
  });
  it("bounds individual geometry complexity before construction", () => {
    for (const geometry of [
      { kind: "cylinder", args: [1, 1, 1, 1000000] },
      { kind: "icosahedron", args: [1, 10] },
      { kind: "box", args: [Infinity, 1, 1] },
      { kind: "ShaderMaterial", args: [] },
    ])
      expect(
        parseScene3D({
          ...fixture3D(),
          nodes: [{ kind: "mesh", material: "stone", geometry }],
        }),
      ).toBeNull();
  });
  it("bounds aggregate complexity, depth, and unknown material references", () => {
    const scene = fixture3D();
    expect(
      parseScene3D({
        ...scene,
        nodes: Array.from({ length: 1025 }, () => scene.nodes[0]),
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...scene,
        nodes: [{ ...scene.nodes[0], material: "absent" }],
      }),
    ).toBeNull();
    let node: unknown = scene.nodes[0];
    for (let i = 0; i < 17; i++) node = { kind: "group", children: [node] };
    expect(parseScene3D({ ...scene, nodes: [node] })).toBeNull();
    expect(
      parseScene3D({
        ...scene,
        nodes: Array.from({ length: 1024 }, () => ({
          kind: "mesh",
          material: "stone",
          geometry: { kind: "icosahedron", args: [1, 3] },
        })),
      }),
    ).toBeNull();
  });
  it("bounds texture allocation, drawing, colors and shadow resources", () => {
    const texture = {
      id: "texture",
      width: 512,
      height: 512,
      rects: [{ x: 0, y: 0, width: 512, height: 512, color: "#abcd" }],
      repeat: [2, 1.5],
      anisotropy: 4,
    };
    expect(
      parseScene3D({ ...fixture3D(), textures: [texture] }),
    ).not.toBeNull();
    for (const change of [
      { width: 8192 },
      { rects: Array(8193).fill(texture.rects[0]) },
      { rects: [{ ...texture.rects[0], color: "url(https://example.com)" }] },
    ])
      expect(
        parseScene3D({ ...fixture3D(), textures: [{ ...texture, ...change }] }),
      ).toBeNull();
  });
});
