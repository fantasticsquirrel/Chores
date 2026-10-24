import { z } from "zod";
import type { Node3D, Scene3D } from "./types";
const number = z.number().finite().min(-2000).max(2000);
const positive = number.min(0.0001);
const unit = z.number().finite().min(0).max(1);
const vec = z.tuple([number, number, number]);
const id = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/)
  .refine(
    (v) => !["constructor", "toString", "prototype", "__proto__"].includes(v),
  );
const color = z.number().int().min(0).max(0xffffff);
const hex = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
const text = z.string().trim().min(1).max(200);
const geometry = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("box"),
      args: z.tuple([positive, positive, positive]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("cylinder"),
      args: z.tuple([
        number.nonnegative(),
        number.nonnegative(),
        positive,
        z.number().int().min(3).max(96),
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("torus"),
      args: z.tuple([
        positive,
        positive,
        z.number().int().min(3).max(32),
        z.number().int().min(3).max(96),
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("circle"),
      args: z.tuple([positive, z.number().int().min(3).max(96)]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("icosahedron"),
      args: z.tuple([positive, z.number().int().min(0).max(3)]),
    })
    .strict(),
  z
    .object({ kind: z.literal("line"), points: z.array(vec).min(2).max(128) })
    .strict(),
  z
    .object({
      kind: z.literal("extrude"),
      depth: positive,
      commands: z
        .array(
          z.discriminatedUnion("op", [
            z
              .object({
                op: z.literal("moveTo"),
                args: z.tuple([number, number]),
              })
              .strict(),
            z
              .object({
                op: z.literal("lineTo"),
                args: z.tuple([number, number]),
              })
              .strict(),
            z
              .object({ op: z.literal("closePath"), args: z.tuple([]) })
              .strict(),
            z
              .object({
                op: z.literal("absarc"),
                args: z.tuple([
                  number,
                  number,
                  positive,
                  number,
                  number,
                  z.number().int().min(0).max(1),
                ]),
              })
              .strict(),
          ]),
        )
        .min(3)
        .max(64),
    })
    .strict(),
]);
const node: z.ZodType<Node3D> = z.lazy(() =>
  z
    .object({
      kind: z.enum(["group", "mesh", "line"]),
      position: vec.optional(),
      rotation: vec.optional(),
      scale: vec
        .refine((v) =>
          v.every((n) => Math.abs(n) >= 0.001 && Math.abs(n) <= 100),
        )
        .optional(),
      visible: z.boolean().optional(),
      castShadow: z.boolean().optional(),
      receiveShadow: z.boolean().optional(),
      material: id.optional(),
      geometry: geometry.optional(),
      children: z.array(node).max(1024).optional(),
    })
    .strict(),
);
const schema = z
  .object({
    materials: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["standard", "basic", "line", "dashed"]),
            color,
            roughness: unit.optional(),
            metalness: unit.optional(),
            opacity: unit.optional(),
            transparent: z.boolean().optional(),
            bumpScale: number.min(-1).max(1).optional(),
            map: id.optional(),
            bumpMap: id.optional(),
            dashSize: positive.optional(),
            gapSize: positive.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    textures: z
      .array(
        z
          .object({
            id,
            width: z.number().int().min(1).max(512),
            height: z.number().int().min(1).max(512),
            rects: z
              .array(
                z
                  .object({
                    x: number,
                    y: number,
                    width: positive,
                    height: positive,
                    color: z
                      .string()
                      .regex(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i),
                  })
                  .strict(),
              )
              .max(8192),
            repeat: z.tuple([positive.max(32), positive.max(32)]),
            anisotropy: z.number().int().min(1).max(4),
          })
          .strict(),
      )
      .max(4),
    nodes: z.array(node).max(1024),
    camera: z
      .object({
        target: vec,
        radius: positive.max(200),
        yaw: number,
        elevation: number.min(0.22).max(1.42),
        zoom: number.min(0.75).max(1.65),
        halfHeight: positive,
        narrowHalfWidth: positive,
        narrowAspect: positive.max(4),
        presets: z
          .array(
            z
              .object({
                id,
                label: text,
                yaw: number,
                elevation: number.min(0.22).max(1.42),
                zoom: number.min(0.75).max(1.65),
              })
              .strict(),
          )
          .max(8),
      })
      .strict(),
    lighting: z
      .object({
        hemisphere: z
          .object({
            sky: color,
            ground: color,
            intensity: number.min(0).max(10),
          })
          .strict(),
        directional: z
          .array(
            z
              .object({
                color,
                intensity: number.min(0).max(10),
                position: vec,
                shadow: z
                  .object({
                    size: z.union([
                      z.literal(512),
                      z.literal(1024),
                      z.literal(2048),
                    ]),
                    extent: positive.max(100),
                    near: positive,
                    far: positive,
                    bias: number.min(-0.1).max(0.1),
                    normalBias: number.min(0).max(1),
                    radius: number.min(0).max(4),
                  })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .max(3),
      })
      .strict(),
    labels: z.array(z.object({ text, position: vec }).strict()).max(12),
    presentation: z
      .object({
        title: text,
        subtitle: text.optional(),
        route: text.optional(),
        background: z.tuple([hex, hex, hex]),
      })
      .strict(),
  })
  .strict();
/** Validate resource bounds before recursive schema parsing or allocating any GPU objects. */
export function parseScene3D(value: unknown): Scene3D | null {
  try {
    if (!value || typeof value !== "object") return null;
    const raw = value as { nodes?: unknown };
    if (!Array.isArray(raw.nodes)) return null;
    const pending = raw.nodes.map((value) => ({ value, depth: 1 }));
    let count = 0;
    while (pending.length) {
      const next = pending.pop()!;
      if (
        ++count > 1024 ||
        next.depth > 16 ||
        !next.value ||
        typeof next.value !== "object"
      )
        return null;
      const children = (next.value as { children?: unknown }).children;
      if (children !== undefined) {
        if (!Array.isArray(children) || children.length > 1024) return null;
        for (const child of children)
          pending.push({ value: child, depth: next.depth + 1 });
      }
    }
    const result = schema.safeParse(value);
    if (!result.success) return null;
    const scene = result.data;
    const materials = new Map(scene.materials.map((m) => [m.id, m]));
    const textures = new Set(scene.textures.map((t) => t.id));
    if (
      materials.size !== scene.materials.length ||
      textures.size !== scene.textures.length
    )
      return null;
    if (
      scene.textures.reduce((sum, t) => sum + t.width * t.height, 0) > 524288 ||
      scene.textures.reduce((sum, t) => sum + t.rects.length, 0) > 8192
    )
      return null;
    if (
      scene.lighting.directional.filter((l) => l.shadow).length > 1 ||
      scene.lighting.directional.some(
        (l) => l.shadow && l.shadow.far <= l.shadow.near,
      )
    )
      return null;
    if (
      new Set(scene.camera.presets.map((p) => p.id)).size !==
      scene.camera.presets.length
    )
      return null;
    for (const m of scene.materials)
      if (
        (m.map && !textures.has(m.map)) ||
        (m.bumpMap && !textures.has(m.bumpMap))
      )
        return null;
    // Local finite values alone do not prevent overflow in nested world matrices.
    const transforms = scene.nodes.map((n) => ({
      n,
      maximum: 1,
      minimum: 1,
      distance: 0,
    }));
    while (transforms.length) {
      const { n, maximum, minimum, distance } = transforms.pop()!;
      const scales = (n.scale ?? [1, 1, 1]).map(Math.abs);
      const nextMaximum = maximum * Math.max(...scales);
      const nextMinimum = minimum * Math.min(...scales);
      const nextDistance =
        distance + Math.hypot(...(n.position ?? [0, 0, 0])) * maximum;
      if (nextMaximum > 1000 || nextMinimum < 0.000001 || nextDistance > 100000)
        return null;
      for (const child of n.children ?? [])
        transforms.push({
          n: child,
          maximum: nextMaximum,
          minimum: nextMinimum,
          distance: nextDistance,
        });
    }
    let triangles = 0;
    const nodes = [...scene.nodes];
    while (nodes.length) {
      const n = nodes.pop()!;
      nodes.push(...(n.children ?? []));
      if (n.kind === "group") {
        if (n.geometry || n.material) return null;
        continue;
      }
      if (!n.geometry || !n.material || !materials.has(n.material)) return null;
      const m = materials.get(n.material)!;
      const g = n.geometry;
      if (
        (n.kind === "line") !== (g.kind === "line") ||
        (n.kind === "line") !== ["line", "dashed"].includes(m.kind)
      )
        return null;
      if (g.kind === "box") triangles += 12;
      else if (g.kind === "cylinder") triangles += g.args[3] * 4;
      else if (g.kind === "torus") triangles += g.args[2] * g.args[3] * 2;
      else if (g.kind === "circle") triangles += g.args[1];
      else if (g.kind === "icosahedron")
        triangles += 20 * Math.pow(4, g.args[1]);
      else if (g.kind === "extrude") {
        if (
          g.commands[0].op !== "moveTo" ||
          g.commands.slice(1).some((c) => c.op === "moveTo")
        )
          return null;
        triangles +=
          g.commands.reduce((sum, c) => sum + (c.op === "absarc" ? 64 : 1), 0) *
          8;
      }
      if (triangles > 150000) return null;
    }
    return scene;
  } catch {
    return null;
  }
}
