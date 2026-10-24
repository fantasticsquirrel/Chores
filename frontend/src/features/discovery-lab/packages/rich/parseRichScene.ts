import {
  richSceneSchema,
  geometryTriangles,
  type RichScene,
} from "./richSceneSchema";
import { validPathGeometry } from "./pathGeometry";
export { geometryTriangles } from "./richSceneSchema";
export type { RichScene, RichNode } from "./richSceneSchema";
/** All validation precedes allocation. Raster references must belong to this authorized payload. */
export function parseRichScene(
  value: unknown,
  assets: ReadonlySet<string> = new Set(),
): RichScene | null {
  try {
    if (!value || typeof value !== "object") return null;
    const raw = value as { nodes?: unknown };
    if (!Array.isArray(raw.nodes)) return null;
    const pending = raw.nodes.map((n) => ({ n, depth: 1 }));
    let count = 0;
    while (pending.length) {
      const { n, depth } = pending.pop()!;
      if (++count > 2048 || depth > 16 || !n || typeof n !== "object")
        return null;
      const children = (n as { children?: unknown }).children;
      if (children !== undefined) {
        if (!Array.isArray(children) || children.length > 2048) return null;
        for (const child of children)
          pending.push({ n: child, depth: depth + 1 });
      }
    }
    const parsed = richSceneSchema.safeParse(value);
    if (!parsed.success) return null;
    const s = parsed.data;
    const geometries = new Map(s.geometries.map((g) => [g.id, g])),
      materials = new Map(s.materials.map((m) => [m.id, m])),
      textures = new Map(s.textures.map((t) => [t.id, t]));
    if (
      geometries.size !== s.geometries.length ||
      materials.size !== s.materials.length ||
      textures.size !== s.textures.length
    )
      return null;
    let generatedVertices = 0;
    let vertices = 0,
      indices = 0,
      pixels = 0;
    for (const g of s.geometries) {
      if (g.kind !== "buffer") {
        const count = geometryTriangles(g);
        if (
          (g.kind === "shape" || g.kind === "extrude") &&
          !validPathGeometry(g)
        )
          return null;
        generatedVertices += count * 3;
        indices += count * 3;
        continue;
      }
      const n = g.positions.length / 3;
      if (
        !Number.isInteger(n) ||
        (g.normals && g.normals.length !== n * 3) ||
        (g.colors && g.colors.length !== n * 3) ||
        (g.uvs && g.uvs.length !== n * 2) ||
        g.indices?.some((i) => i >= n)
      )
        return null;
      vertices += n;
      indices += g.indices?.length ?? n;
    }
    if (vertices > 150000 || generatedVertices > 900000 || indices > 900000)
      return null;
    for (const t of s.textures) {
      if (!assets.has(t.asset) || t.width * t.height > 4000000) return null;
      pixels += t.width * t.height;
    }
    if (pixels > 16777216) return null;
    for (const m of s.materials)
      if (
        (m.map && !textures.has(m.map)) ||
        (m.bumpMap && !textures.has(m.bumpMap))
      )
        return null;
    if (
      s.lighting.directional.filter((l) => l.shadow).length > 1 ||
      s.lighting.directional.some(
        (l) => l.shadow && l.shadow.near >= l.shadow.far,
      )
    )
      return null;
    if (
      (s.camera.near ?? 0.1) >= (s.camera.far ?? 2000) ||
      new Set(s.camera.presets.map((p) => p.id)).size !==
        s.camera.presets.length
    )
      return null;
    const nodeIds = new Set<string>(),
      queue = s.nodes.map((n) => ({ n, max: 1, min: 1, distance: 0 }));
    let triangles = 0;
    while (queue.length) {
      const { n, max, min, distance } = queue.pop()!;
      if (n.id) {
        if (nodeIds.has(n.id)) return null;
        nodeIds.add(n.id);
      }
      const scale = (n.scale ?? [1, 1, 1]).map(Math.abs),
        nextMax = max * Math.max(...scale),
        nextMin = min * Math.min(...scale),
        nextDistance =
          distance + Math.hypot(...(n.position ?? [0, 0, 0])) * max;
      if (nextMax > 1000 || nextMin < 1e-12 || nextDistance > 100000)
        return null;
      for (const child of n.children ?? [])
        queue.push({
          n: child,
          max: nextMax,
          min: nextMin,
          distance: nextDistance,
        });
      if (n.kind === "group") {
        if (n.geometry || n.material) return null;
        continue;
      }
      const g = geometries.get(n.geometry ?? ""),
        m = materials.get(n.material ?? "");
      if (!g || !m) return null;
      if (
        (n.kind === "line" || n.kind === "segments") !==
          ["line", "dashed"].includes(m.kind) ||
        (n.kind === "points") !== (m.kind === "points")
      )
        return null;
      const length =
        g.kind === "buffer"
          ? (g.indices?.length ?? g.positions.length / 3)
          : geometryTriangles(g) * 3;
      if (n.kind === "mesh") {
        if (length % 3) return null;
        triangles += length / 3;
      }
      if (n.kind === "segments" && length % 2) return null;
    }
    if (triangles > 300000) return null;
    return s;
  } catch {
    return null;
  }
}
