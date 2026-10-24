import { shapeFields, pathPointBudget } from "./pathGeometry";
import { z } from "zod";
const number = z.number().finite().min(-2000).max(2000),
  positive = number.min(0.000001),
  unit = number.min(0).max(1);
const id = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/)
  .refine(
    (v) => !["constructor", "prototype", "__proto__", "toString"].includes(v),
  );
const vec = z.tuple([number, number, number]),
  color = z.number().int().min(0).max(0xffffff),
  text = z.string().trim().min(1).max(200);
const bufferGeometry = z
  .object({
    id,
    kind: z.literal("buffer"),
    positions: z.array(number).min(3).max(300000),
    normals: z.array(number.min(-1.001).max(1.001)).max(300000).optional(),
    colors: z.array(unit).max(300000).optional(),
    uvs: z.array(number).max(200000).optional(),
    indices: z.array(z.number().int().min(0).max(99999)).max(450000).optional(),
  })
  .strict();
const segments = z.number().int().min(1).max(128),
  radial = z.number().int().min(3).max(128),
  angle = number.min(-Math.PI * 2).max(Math.PI * 2),
  arc = positive.max(Math.PI * 2),
  flag = z.union([z.literal(0), z.literal(1)]);
const geometry = z.discriminatedUnion("kind", [
  bufferGeometry,
  z.object({ id, kind: z.literal("shape"), ...shapeFields }).strict(),
  z
    .object({ id, kind: z.literal("extrude"), depth: positive, ...shapeFields })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("sphere"),
      args: z.tuple([
        positive,
        radial,
        segments.min(2),
        angle,
        arc,
        angle,
        arc,
      ]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("box"),
      args: z.tuple([
        positive,
        positive,
        positive,
        segments,
        segments,
        segments,
      ]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("plane"),
      args: z.tuple([positive, positive, segments, segments]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("cylinder"),
      args: z.tuple([
        number.min(0),
        number.min(0),
        positive,
        radial,
        segments,
        flag,
        angle,
        arc,
      ]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("cone"),
      args: z.tuple([positive, positive, radial, segments, flag, angle, arc]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("torus"),
      args: z.tuple([positive, positive, radial, radial, arc]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("circle"),
      args: z.tuple([positive, radial, angle, arc]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("ring"),
      args: z.tuple([number.min(0), positive, radial, segments, angle, arc]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("icosahedron"),
      args: z.tuple([positive, z.number().int().min(0).max(5)]),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("dodecahedron"),
      args: z.tuple([positive, z.number().int().min(0).max(4)]),
    })
    .strict(),
]);
export function geometryTriangles(g: z.infer<typeof geometry>): number {
  if (g.kind === "buffer")
    return (g.indices?.length ?? g.positions.length / 3) / 3;
  if (g.kind === "shape" || g.kind === "extrude")
    return pathPointBudget(g) * (g.kind === "extrude" ? 4 : 1) + 4;
  const a: number[] = g.args;
  switch (g.kind) {
    case "sphere":
      return a[1] * a[2] * 2;
    case "box":
      return 4 * (a[3] * a[4] + a[4] * a[5] + a[3] * a[5]);
    case "plane":
      return 2 * a[2] * a[3];
    case "cylinder":
      return 2 * a[3] * (a[4] + 1);
    case "cone":
      return 2 * a[2] * (a[3] + 1);
    case "torus":
      return 2 * a[2] * a[3];
    case "circle":
      return a[1];
    case "ring":
      return 2 * a[2] * a[3];
    case "icosahedron":
      return 20 * (a[1] + 1) ** 2;
    case "dodecahedron":
      return 36 * (a[1] + 1) ** 2;
  }
}
const material = z
  .object({
    id,
    kind: z.enum([
      "standard",
      "basic",
      "line",
      "dashed",
      "physical",
      "points",
      "shadow",
    ]),
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
    side: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    depthWrite: z.boolean().optional(),
    depthTest: z.boolean().optional(),
    emissive: color.optional(),
    emissiveIntensity: number.min(0).max(10).optional(),
    vertexColors: z.boolean().optional(),
    size: positive.max(100).optional(),
    sizeAttenuation: z.boolean().optional(),
    transmission: unit.optional(),
    thickness: number.min(0).max(10).optional(),
    ior: number.min(1).max(2.333).optional(),
    flatShading: z.boolean().optional(),
    wireframe: z.boolean().optional(),
    toneMapped: z.boolean().optional(),
  })
  .strict();
const texture = z
  .object({
    id,
    asset: z
      .string()
      .regex(/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg)$/),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    repeat: z.tuple([positive.max(32), positive.max(32)]),
    anisotropy: z.number().int().min(1).max(4),
    colorSpace: z.enum(["srgb", "linear"]).optional(),
    wrap: z.enum(["repeat", "clamp"]).optional(),
    flipY: z.boolean().optional(),
    offset: z.tuple([number, number]).optional(),
    rotation: angle.optional(),
    center: z.tuple([number, number]).optional(),
  })
  .strict();
export type RichNode = {
  id?: string;
  kind: "group" | "mesh" | "line" | "segments" | "points";
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  material?: string;
  geometry?: string;
  children?: RichNode[];
  renderOrder?: number;
};
const node: z.ZodType<RichNode> = z.lazy(() =>
  z
    .object({
      id: id.optional(),
      kind: z.enum(["group", "mesh", "line", "segments", "points"]),
      position: vec.optional(),
      rotation: vec.optional(),
      scale: vec
        .refine((v) =>
          v.every((n) => Math.abs(n) >= 0.000001 && Math.abs(n) <= 100),
        )
        .optional(),
      visible: z.boolean().optional(),
      castShadow: z.boolean().optional(),
      receiveShadow: z.boolean().optional(),
      material: id.optional(),
      geometry: id.optional(),
      children: z.array(node).max(2048).optional(),
      renderOrder: number.optional(),
    })
    .strict(),
);
const shadow = z
  .object({
    size: z.union([z.literal(512), z.literal(1024), z.literal(2048)]),
    extent: positive.max(100),
    near: positive,
    far: positive,
    bias: number.min(-0.1).max(0.1),
    normalBias: unit,
    radius: number.min(0).max(4),
  })
  .strict();
export const richSceneSchema = z
  .object({
    geometries: z.array(geometry).max(1024),
    materials: z.array(material).min(1).max(256),
    textures: z.array(texture).max(32),
    nodes: z.array(node).max(2048),
    camera: z
      .object({
        kind: z.enum(["orthographic", "perspective"]).optional(),
        interactive: z.boolean().optional(),
        position: vec.optional(),
        up: vec.refine((v) => Math.hypot(...v) > 0.001).optional(),
        fov: number.min(10).max(100).optional(),
        near: positive.optional(),
        far: positive.optional(),
        target: vec,
        radius: positive.max(200),
        yaw: number,
        elevation: number.min(-1.56).max(1.56),
        zoom: positive.max(10),
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
                elevation: number.min(-1.56).max(1.56),
                zoom: positive.max(10),
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
                target: vec.optional(),
                shadow: shadow.optional(),
              })
              .strict(),
          )
          .max(4),
        ambient: z
          .object({ color, intensity: number.min(0).max(10) })
          .strict()
          .optional(),
        point: z
          .array(
            z
              .object({
                color,
                intensity: number.min(0).max(100),
                position: vec,
                distance: number.min(0).max(1000),
                decay: number.min(0).max(4),
              })
              .strict(),
          )
          .max(4)
          .optional(),
      })
      .strict(),
    labels: z
      .array(
        z
          .object({
            text,
            position: vec,
            left: number.min(0).max(100).optional(),
            top: number.min(0).max(100).optional(),
          })
          .strict(),
      )
      .max(32),
    presentation: z
      .object({
        title: text,
        showHeading: z.boolean().optional(),
        layout: z
          .object({
            height: z.number().finite().min(200).max(1000),
            canvasInset: z.tuple([
              z.union([
                number.min(-200).max(300),
                z.string().regex(/^-?(?:[0-9]|[12][0-9]|30)%$/),
              ]),
              z.union([
                number.min(-200).max(300),
                z.string().regex(/^-?(?:[0-9]|[12][0-9]|30)%$/),
              ]),
              z.union([
                number.min(-200).max(300),
                z.string().regex(/^-?(?:[0-9]|[12][0-9]|30)%$/),
              ]),
              z.union([
                number.min(-200).max(300),
                z.string().regex(/^-?(?:[0-9]|[12][0-9]|30)%$/),
              ]),
            ]),
          })
          .strict()
          .optional(),
        stat: z
          .object({
            value: z.string().trim().min(1).max(120),
            corner: z
              .enum(["top-right", "top-left", "bottom-right", "bottom-left"])
              .optional(),
            label: z.string().trim().min(1).max(120),
          })
          .strict()
          .optional(),
        gestureHint: z.string().trim().min(1).max(160).optional(),
        toneMapping: z.enum(["none", "aces"]).optional(),
        exposure: number.min(0.1).max(3).optional(),
        subtitle: text.optional(),
        route: text.optional(),
        background: z.tuple([
          z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
          z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
          z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
        ]),
      })
      .strict(),
  })
  .strict();
export type RichScene = z.infer<typeof richSceneSchema>;
