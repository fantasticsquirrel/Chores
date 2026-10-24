/** Independent adversarial review of rich-host boundaries, separate from author tests. */
import { describe, expect, it } from "vitest";
import { parseScene } from "../bridge";
import { createPathGeometry } from "./createPathGeometry";
import { pathPointBudget } from "./pathGeometry";
import { geometryTriangles, parseRichScene } from "./parseRichScene";
import { parseRichVector } from "./vectorModel";
import { parseTones } from "./audio";
import { rasterDimensions } from "./rasterAssets";
import { richFixture } from "./testFixture";
const vector = (nodes: unknown[]) => ({
  viewBox: [0, 0, 100, 100],
  description: "Boundary test",
  nodes,
});
const node = (
  tag: string,
  attrs: Record<string, string | number> = {},
  children: unknown[] = [],
) => ({ tag, attrs, children });
describe("independent rich runtime security review", () => {
  it("rejects PNG animations before native decoding can bypass per-frame pixel budgets", () => {
    const encoded =
      "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAEAAAABAAAAAAAAAAAAAEACgAAV3ID4QAAABVJREFUeJxj/M/A8J8BCTAxoAHCAgCD0QIGApDvWAAAABpmY1RMAAAAAQAAAAQAAAAEAAAAAAAAAAAAAQAKAADMAek1AAAAGWZkQVQAAAACeJxjZGD4/58BCTAxoAHCAgCB0wIGTKM7fwAAAABJRU5ErkJggg==";
    expect(
      rasterDimensions(
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
        "image/png",
      ),
    ).toBeNull();
  });
  it("rejects transform overflow within one attribute and across nested groups", () => {
    expect(
      parseRichVector(
        vector([
          node("g", { transform: "scale(10000) ".repeat(80) }, [
            node("rect", { width: 10, height: 10 }),
          ]),
        ]),
      ),
    ).toBeNull();
    let nested = node("rect", { width: 10, height: 10 });
    for (let i = 0; i < 4; i++)
      nested = node("g", { transform: "scale(10000)" }, [nested]);
    expect(parseRichVector(vector([nested]))).toBeNull();
    expect(
      parseRichVector(
        vector([
          node("g", { transform: "translate(2,3) rotate(30) scale(2)" }, [
            node("rect", { width: 10, height: 10 }),
          ]),
        ]),
      ),
    ).not.toBeNull();
  });
  it("rejects cyclic local paint and clip resources, not just missing references", () => {
    const self = node("pattern", { id: "p", width: 10, height: 10 }, [
      node("rect", { width: 10, height: 10, fill: "url(#p)" }),
    ]);
    expect(
      parseRichVector(
        vector([
          node("defs", {}, [self]),
          node("rect", { width: 20, height: 20, fill: "url(#p)" }),
        ]),
      ),
    ).toBeNull();
    const a = node("pattern", { id: "a", width: 10, height: 10 }, [
      node("rect", { width: 10, height: 10, fill: "url(#b)" }),
    ]);
    const b = node("pattern", { id: "b", width: 10, height: 10 }, [
      node("rect", { width: 10, height: 10, fill: "url(#a)" }),
    ]);
    expect(
      parseRichVector(
        vector([
          node("defs", {}, [a, b]),
          node("rect", { width: 20, height: 20, fill: "url(#a)" }),
        ]),
      ),
    ).toBeNull();
  });
  it("rejects vector URL encodings, executable tags, event props and nonlocal paint", () => {
    for (const bad of [
      node("script", {}, ["alert(1)"]),
      node("foreignObject"),
      node("image", { href: "https://attacker.invalid/x" }),
      node("rect", { onload: "alert(1)" }),
      node("rect", { style: "background:url(https://attacker.invalid)" }),
      node("rect", { fill: "url(https://attacker.invalid/x)" }),
      node("rect", { fill: "url(data:image/svg+xml;base64,eA==)" }),
      node("rect", { fill: "url(\\23p)" }),
      node("g", { transform: "translate(0)url(https://attacker.invalid)" }),
    ])
      expect(parseRichVector(vector([bad]))).toBeNull();
  });
  it("revalidates resource patches against the current authorization and previous frame", () => {
    const base = {
      description: "Observe",
      shapes: [],
      controls: [],
      scene3d: richFixture(),
    };
    const previous = parseScene(base, "rich")!;
    expect(previous).not.toBeNull();
    const raw = { ...base.scene3d } as Record<string, unknown>;
    delete raw.geometries;
    delete raw.materials;
    delete raw.textures;
    const patch = { ...base, scene3d: { ...raw, reuseResources: true } };
    expect(parseScene(patch, "rich")).toBeNull();
    expect(parseScene(patch, "rich", new Set(), previous)).not.toBeNull();
    expect(
      parseScene(
        { ...patch, scene3d: { ...patch.scene3d, materials: [] } },
        "rich",
        new Set(),
        previous,
      ),
    ).toBeNull();
    expect(
      parseScene(
        {
          ...patch,
          scene3d: {
            ...patch.scene3d,
            geometries: [
              {
                id: "g0",
                kind: "buffer",
                positions: [0, 0, 0],
                indices: [0, 1, 2],
              },
            ],
          },
        },
        "rich",
        new Set(),
        previous,
      ),
    ).toBeNull();
    const textured = {
      ...base,
      scene3d: {
        ...base.scene3d,
        textures: [
          {
            id: "t",
            asset: "a.png",
            width: 1,
            height: 1,
            repeat: [1, 1],
            anisotropy: 1,
          },
        ],
      },
    };
    const authorized = parseScene(textured, "rich", new Set(["a.png"]))!;
    expect(authorized).not.toBeNull();
    expect(parseScene(patch, "rich", new Set(), authorized)).toBeNull();
  });
  it("rejects shared-buffer instancing and repeated textures above aggregate render budgets", () => {
    const s = richFixture();
    const big = {
      id: "g0",
      kind: "sphere",
      args: [1, 128, 128, 0, Math.PI * 2, 0, Math.PI],
    };
    expect(
      parseRichScene({
        ...s,
        geometries: [big],
        nodes: Array.from({ length: 10 }, () => s.nodes[0]),
      }),
    ).toBeNull();
    const textures = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      asset: "a.png",
      width: 2048,
      height: 2048,
      repeat: [1, 1],
      anisotropy: 1,
    }));
    expect(parseRichScene({ ...s, textures }, new Set(["a.png"]))).toBeNull();
  });
  it("rejects malformed attribute lengths, negative indices and nonfinite normals before allocation", () => {
    const s = richFixture();
    for (const patch of [
      { indices: [-1, 0, 1] },
      { indices: [0, 1.1, 2] },
      { normals: Array(9).fill(Infinity) },
      { uvs: [0, 0] },
      { positions: [0, 0] },
      { indices: [0, 1] },
    ])
      expect(
        parseRichScene({
          ...s,
          geometries: [{ ...s.geometries[0], ...patch }],
        }),
      ).toBeNull();
  });
  it("permits no implicit tone, external media source, excess gain, duration or custom waveform", () => {
    const good = {
      buttonId: "play",
      frequency: 440,
      duration: 0.1,
      gain: 0.1,
      waveform: "sine",
    };
    expect(parseTones([good], new Set(["play"]))).not.toBeNull();
    for (const patch of [
      { src: "https://attacker.invalid/sound" },
      { gain: 0.16 },
      { duration: 3 },
      { waveform: "custom" },
      { frequency: Infinity },
      { buttonId: "unrequested" },
    ])
      expect(parseTones([{ ...good, ...patch }], new Set(["play"]))).toBeNull();
  });
});

describe("independent parametric geometry boundary review", () => {
  const path = {
    id: "g0",
    kind: "extrude",
    depth: 0.2,
    curveSegments: 64,
    commands: [
      { op: "moveTo", args: [0, 0] },
      { op: "lineTo", args: [1, 0] },
      { op: "absellipse", args: [0, 0, 1, 1, 0, Math.PI * 2, 0, 0] },
      { op: "closePath", args: [] },
    ],
  };
  const parse = (patch: Record<string, unknown> = {}) =>
    parseRichScene({ ...richFixture(), geometries: [{ ...path, ...patch }] });
  it("rejects malformed paths, nonfinite arguments and unsupported executable options before allocation", () => {
    for (const patch of [
      { depth: 0 },
      { depth: -1 },
      { depth: Infinity },
      { depth: 2001 },
      { curveSegments: 0 },
      { curveSegments: 1.5 },
      { curveSegments: 65 },
      { curveSegments: NaN },
      { steps: 1000000 },
      { bevelSegments: 1000000 },
      { extrudePath: { getPoint: "callback" } },
      { holes: [path.commands] },
      { commands: [] },
      { commands: Array(65).fill({ op: "lineTo", args: [0, 0] }) },
      {
        commands: [
          { op: "lineTo", args: [0, 0] },
          { op: "closePath", args: [] },
        ],
      },
      {
        commands: [
          { op: "moveTo", args: [0, 0] },
          { op: "moveTo", args: [1, 1] },
        ],
      },
      ...[
        { op: "constructor", args: [] },
        { op: "getPoint", args: [] },
        { op: "bezierCurveTo", args: [0, 0, 1, 1, Infinity, 0] },
        { op: "quadraticCurveTo", args: [0, 0, 1] },
        { op: "lineTo", args: [2001, 0] },
        { op: "lineTo", args: [0, 0], callback: "alert(1)" },
        { op: "absellipse", args: [0, 0, 0, 1, 0, 1, 0, 0] },
        { op: "absellipse", args: [0, 0, 1, 1, 0, 7, 0, 0] },
        { op: "absellipse", args: [0, 0, 1, 1, 0, 1, true, 0] },
        { op: "closePath", args: [1] },
      ].map((c) => ({ commands: [path.commands[0], c] })),
    ])
      expect(parse(patch), JSON.stringify(patch)).toBeNull();
  });
  it("counts curves and connecting edges before host construction, with bounded actual Three allocations", () => {
    for (const kind of ["shape", "extrude"]) {
      for (const commands of [
        path.commands,
        [
          path.commands[0],
          ...Array(7).fill(path.commands[2]),
          path.commands[3],
        ],
        [
          path.commands[0],
          ...Array(15).fill({
            op: "bezierCurveTo",
            args: [2, 3, -2, -3, 1, 0],
          }),
          path.commands[3],
        ],
        [
          path.commands[0],
          ...Array(15).fill({ op: "quadraticCurveTo", args: [2, 3, 1, 0] }),
          path.commands[3],
        ],
      ]) {
        const geometry = { ...path, kind, commands } as Record<string, unknown>;
        if (kind === "shape") delete geometry.depth;
        const scene = parseRichScene({
          ...richFixture(),
          geometries: [geometry],
        });
        expect(scene).not.toBeNull();
        const g = scene!.geometries[0];
        if (g.kind !== "shape" && g.kind !== "extrude")
          throw Error("wrong kind");
        expect(pathPointBudget(g)).toBeLessThanOrEqual(1024);
        const allocated = createPathGeometry(g);
        try {
          const triangles =
            (allocated.index?.count ??
              allocated.getAttribute("position").count) / 3;
          expect(triangles).toBeLessThanOrEqual(geometryTriangles(g));
          expect(allocated.getAttribute("position").count).toBeLessThanOrEqual(
            geometryTriangles(g) * 3,
          );
        } finally {
          allocated.dispose();
        }
      }
    }
    expect(
      parse({
        commands: [path.commands[0], ...Array(8).fill(path.commands[2])],
      }),
    ).toBeNull();
    expect(
      parse({
        commands: [
          path.commands[0],
          ...Array(16).fill({ op: "bezierCurveTo", args: [0, 0, 1, 1, 1, 0] }),
        ],
      }),
    ).toBeNull();
  });
  it("enforces aggregate generated resources even if unused and instances even if shared", () => {
    const s = richFixture();
    const g = parse()!.geometries[0];
    const budgetCount = Math.floor(300000 / geometryTriangles(g));
    expect(
      parseRichScene({
        ...s,
        geometries: [g],
        nodes: Array(budgetCount).fill(s.nodes[0]),
      }),
    ).not.toBeNull();
    expect(
      parseRichScene({
        ...s,
        geometries: [g],
        nodes: Array(budgetCount + 1).fill(s.nodes[0]),
      }),
    ).toBeNull();
    expect(
      parseRichScene({
        ...s,
        nodes: [],
        geometries: Array.from({ length: budgetCount + 1 }, (_, i) => ({
          ...g,
          id: `g${i}`,
        })),
      }),
    ).toBeNull();
  });
  it("accepts a fixed camera and bounded authored stage without allowing CSS or type injection", () => {
    const s = richFixture();
    expect(
      parseRichScene({
        ...s,
        camera: { ...s.camera, interactive: false },
        presentation: {
          ...s.presentation,
          layout: { height: 200, canvasInset: [-200, "-30%", 300, "30%"] },
        },
      }),
    ).not.toBeNull();
    for (const interactive of [0, "false", null, {}, []])
      expect(
        parseRichScene({ ...s, camera: { ...s.camera, interactive } }),
      ).toBeNull();
    for (const layout of [
      { height: 199, canvasInset: [0, 0, 0, 0] },
      { height: 1001, canvasInset: [0, 0, 0, 0] },
      { height: Infinity, canvasInset: [0, 0, 0, 0] },
      { height: "100vh", canvasInset: [0, 0, 0, 0] },
      { height: 300, canvasInset: [0, 0, 0] },
      { height: 300, canvasInset: [301, 0, 0, 0] },
      { height: 300, canvasInset: ["31%", 0, 0, 0] },
      { height: 300, canvasInset: ["calc(100% + 5px)", 0, 0, 0] },
      { height: 300, canvasInset: ["url(https://attacker.invalid)", 0, 0, 0] },
      { height: 300, canvasInset: [0, 0, 0, 0], position: "fixed" },
    ])
      expect(
        parseRichScene({ ...s, presentation: { ...s.presentation, layout } }),
      ).toBeNull();
  });
});
