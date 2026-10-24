import { describe, expect, it } from "vitest";
import { parseScene3D } from "./parseScene3D";
import { parseScene } from "../bridge";

function fixture() {
  return {
    materials: [{ id: "surface", kind: "standard", color: 0xaabbcc }],
    textures: [],
    nodes: [
      {
        kind: "mesh",
        material: "surface",
        geometry: { kind: "box", args: [1, 1, 1] },
      },
    ],
    camera: {
      target: [0, 0, 0],
      radius: 80,
      yaw: 0.6,
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
      title: "Observe the model",
      background: ["#aabbcc", "#bbccdd", "#ccddee"],
    },
  };
}
const texture = (id: string, count = 1) => ({
  id,
  width: 512,
  height: 512,
  repeat: [1, 1],
  anisotropy: 1,
  rects: Array.from({ length: count }, () => ({
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    color: "#12345678",
  })),
});
const light = {
  color: 0xffffff,
  intensity: 1,
  position: [0, 2, 0],
  shadow: {
    size: 2048,
    extent: 48,
    near: 1,
    far: 130,
    bias: 0,
    normalBias: 0,
    radius: 1,
  },
};

describe("independent 3D package adversarial review", () => {
  it("accepts only explicit material properties, never URL/shader/loader hooks", () => {
    for (const extra of [
      { url: "https://example.invalid/steal" },
      { onBeforeCompile: "alert(1)" },
      { vertexShader: "void main(){}" },
      { type: "ShaderMaterial" },
      JSON.parse('{"__proto__":{"polluted":true}}'),
    ]) {
      expect(
        parseScene3D({
          ...fixture(),
          materials: [{ ...fixture().materials[0], ...extra }],
        }),
      ).toBeNull();
      expect(
        parseScene3D({
          ...fixture(),
          nodes: [{ ...fixture().nodes[0], ...extra }],
        }),
      ).toBeNull();
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it("rejects duplicate identifiers and all dangling resource references", () => {
    const base = fixture();
    expect(
      parseScene3D({
        ...base,
        materials: [base.materials[0], base.materials[0]],
      }),
    ).toBeNull();
    expect(
      parseScene3D({ ...base, textures: [texture("paint"), texture("paint")] }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...base,
        materials: [{ ...base.materials[0], map: "missing" }],
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...base,
        materials: [{ ...base.materials[0], bumpMap: "missing" }],
      }),
    ).toBeNull();
    for (const id of ["constructor", "prototype", "__proto__", "toString"])
      expect(
        parseScene3D({
          ...base,
          materials: [{ ...base.materials[0], id }],
          nodes: [{ ...base.nodes[0], material: id }],
        }),
      ).toBeNull();
  });
  it("rejects mixed node/material/geometry kinds instead of forwarding to Three", () => {
    const base = fixture();
    expect(
      parseScene3D({ ...base, nodes: [{ ...base.nodes[0], kind: "group" }] }),
    ).toBeNull();
    expect(
      parseScene3D({ ...base, nodes: [{ ...base.nodes[0], kind: "line" }] }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...base,
        nodes: [
          {
            ...base.nodes[0],
            geometry: {
              kind: "line",
              points: [
                [0, 0, 0],
                [1, 1, 1],
              ],
            },
          },
        ],
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...base,
        materials: [{ ...base.materials[0], kind: "dashed" }],
      }),
    ).toBeNull();
  });
  it("enforces aggregate triangle budget even when each geometry is valid", () => {
    const node = {
      ...fixture().nodes[0],
      geometry: { kind: "torus", args: [1, 0.1, 32, 96] },
    };
    expect(
      parseScene3D({ ...fixture(), nodes: Array(24).fill(node) }),
    ).not.toBeNull();
    expect(
      parseScene3D({ ...fixture(), nodes: Array(25).fill(node) }),
    ).toBeNull();
  });
  it("enforces aggregate node and depth budgets and handles cycles safely", () => {
    const base = fixture();
    expect(
      parseScene3D({ ...base, nodes: Array(1024).fill(base.nodes[0]) }),
    ).not.toBeNull();
    expect(
      parseScene3D({
        ...base,
        nodes: [{ kind: "group", children: Array(1024).fill(base.nodes[0]) }],
      }),
    ).toBeNull();
    let nested: unknown = base.nodes[0];
    for (let i = 0; i < 15; i++) nested = { kind: "group", children: [nested] };
    expect(parseScene3D({ ...base, nodes: [nested] })).not.toBeNull();
    expect(
      parseScene3D({ ...base, nodes: [{ kind: "group", children: [nested] }] }),
    ).toBeNull();
    const cyclic: { kind: string; children: unknown[] } = {
      kind: "group",
      children: [],
    };
    cyclic.children.push(cyclic);
    expect(parseScene3D({ ...base, nodes: [cyclic] })).toBeNull();
  });
  it("enforces aggregate texture pixels and rectangle count, not only per-texture caps", () => {
    expect(
      parseScene3D({ ...fixture(), textures: [texture("a"), texture("b")] }),
    ).not.toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        textures: [texture("a"), texture("b"), texture("c")],
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        textures: [texture("a", 4096), texture("b", 4096)],
      }),
    ).not.toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        textures: [texture("a", 4096), texture("b", 4097)],
      }),
    ).toBeNull();
  });
  it("does not let texture CSS paint trigger network or arbitrary syntax", () => {
    for (const color of [
      "url(https://example.invalid/image)",
      "red",
      "#ffffff;display:none",
      "rgb(1,2,3)",
      "#12345",
      "#123456789",
    ]) {
      const t = texture("a");
      t.rects[0].color = color;
      expect(parseScene3D({ ...fixture(), textures: [t] })).toBeNull();
    }
  });
  it("bounds shadow allocations and rejects reversed frustums", () => {
    expect(
      parseScene3D({
        ...fixture(),
        lighting: { ...fixture().lighting, directional: [light] },
      }),
    ).not.toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        lighting: { ...fixture().lighting, directional: [light, light] },
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        lighting: {
          ...fixture().lighting,
          directional: [{ ...light, shadow: { ...light.shadow, size: 4096 } }],
        },
      }),
    ).toBeNull();
    expect(
      parseScene3D({
        ...fixture(),
        lighting: {
          ...fixture().lighting,
          directional: [{ ...light, shadow: { ...light.shadow, near: 130 } }],
        },
      }),
    ).toBeNull();
  });
  it("rejects malformed path operations and nonfinite inputs", () => {
    for (const geometry of [
      {
        kind: "extrude",
        depth: 1,
        commands: [
          { op: "lineTo", args: [0, 0] },
          { op: "lineTo", args: [1, 1] },
          { op: "closePath", args: [] },
        ],
      },
      {
        kind: "extrude",
        depth: 1,
        commands: [
          { op: "moveTo", args: [0, 0] },
          { op: "moveTo", args: [1, 1] },
          { op: "closePath", args: [] },
        ],
      },
      {
        kind: "extrude",
        depth: 1,
        commands: [
          { op: "moveTo", args: [0, 0] },
          { op: "eval", args: [1, 1] },
          { op: "closePath", args: [] },
        ],
      },
      { kind: "box", args: [NaN, 1, 1] },
      { kind: "box", args: [1, Infinity, 1] },
    ])
      expect(
        parseScene3D({
          ...fixture(),
          nodes: [{ ...fixture().nodes[0], geometry }],
        }),
      ).toBeNull();
  });
  it("rejects oversized outer messages including unrelated unknown fields", () => {
    expect(
      parseScene({
        description: "Evidence",
        animate: false,
        controls: [],
        shapes: [],
        scene3d: fixture(),
        unrelated: "x".repeat(524288),
      }),
    ).toBeNull();
  });
  it("rejects malformed toggle/select inputs at the package boundary", () => {
    const c = {
      id: "control",
      label: "Control",
      min: 0,
      max: 1,
      step: 1,
      value: 0,
    };
    for (const control of [
      { ...c, kind: "toggle", value: 0.5 },
      { ...c, kind: "toggle", max: 2 },
      { ...c, kind: "select", options: [null, null] },
      {
        ...c,
        kind: "select",
        options: [
          { value: 0, label: "A" },
          { value: 0, label: "B" },
        ],
      },
      {
        ...c,
        kind: "select",
        options: [
          { value: 0, label: "A" },
          { value: 2, label: "B" },
        ],
      },
      {
        ...c,
        kind: "select",
        value: 0.5,
        options: [
          { value: 0, label: "A" },
          { value: 1, label: "B" },
        ],
      },
    ])
      expect(
        parseScene({
          description: "Evidence",
          shapes: [],
          controls: [control],
        }),
      ).toBeNull();
  });
  it("requires an explicit 3D runtime and demand-rendering contract", () => {
    const output = {
      description: "Evidence",
      shapes: [],
      controls: [],
      scene3d: fixture(),
      animate: false,
    };
    expect(parseScene(output)).toBeNull();
    expect(parseScene(output, "3d")).not.toBeNull();
    expect(parseScene({ ...output, animate: true }, "3d")).toBeNull();
    expect(parseScene({ ...output, animate: undefined }, "3d")).toBeNull();
    expect(
      parseScene(
        { description: "Evidence", shapes: [], controls: [], animate: false },
        "3d",
      ),
    ).toBeNull();
  });
  it("rejects projection dimensions that overflow finite GPU math", () => {
    for (const key of [
      "halfHeight",
      "narrowHalfWidth",
      "radius",
      "narrowAspect",
    ]) {
      expect(
        parseScene3D({
          ...fixture(),
          camera: { ...fixture().camera, [key]: Number.MIN_VALUE },
        }),
      ).toBeNull();
    }
    expect(
      parseScene3D({
        ...fixture(),
        lighting: {
          ...fixture().lighting,
          directional: [
            { ...light, shadow: { ...light.shadow, extent: Number.MIN_VALUE } },
          ],
        },
      }),
    ).toBeNull();
  });
  it("rejects composed transforms that exceed finite GPU coordinates", () => {
    let nested: unknown = { ...fixture().nodes[0], scale: [2000, 2000, 2000] };
    for (let i = 0; i < 15; i++)
      nested = { kind: "group", scale: [2000, 2000, 2000], children: [nested] };
    expect(parseScene3D({ ...fixture(), nodes: [nested] })).toBeNull();
  });
});
