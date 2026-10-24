export type RichVectorNode = {
  tag: string;
  attrs: Record<string, string | number>;
  children: (RichVectorNode | string)[];
};
export type RichVector = {
  viewBox: [number, number, number, number];
  nodes: RichVectorNode[];
  description: string;
  pointer?: boolean;
  inset?: {
    width: number;
    corner: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  };
};
const tags = new Set([
  "g",
  "defs",
  "circle",
  "ellipse",
  "rect",
  "line",
  "path",
  "polygon",
  "polyline",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "clipPath",
  "filter",
  "feDropShadow",
]);
const numeric = new Set([
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "strokeWidth",
  "strokeOpacity",
  "fillOpacity",
  "opacity",
  "fontSize",
  "offset",
  "stopOpacity",
  "fx",
  "fy",
  "dx",
  "dy",
  "stdDeviation",
  "floodOpacity",
]);
const colors = new Set(["fill", "stroke", "stopColor", "floodColor"]);
const enums: Record<string, string[]> = {
  fontFamily: ["Georgia", "serif", "system-ui"],
  textAnchor: ["start", "middle", "end"],
  strokeLinecap: ["butt", "round", "square"],
  strokeLinejoin: ["miter", "round", "bevel"],
  fillRule: ["nonzero", "evenodd"],
  clipRule: ["nonzero", "evenodd"],
  patternUnits: ["userSpaceOnUse", "objectBoundingBox"],
  gradientUnits: ["userSpaceOnUse", "objectBoundingBox"],
  dominantBaseline: ["auto", "middle", "central", "hanging"],
  fontWeight: ["normal", "bold", "400", "500", "600", "700"],
  vectorEffect: ["non-scaling-stroke"],
};
const validId = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(v);
const finite = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 10000;
const nums = (s: string) => {
  const parts = s.trim().split(/[\s,]+/);
  return (
    parts.length > 0 &&
    parts.length <= 8192 &&
    parts.every((v) => v !== "" && finite(Number(v)))
  );
};
type Affine = [number, number, number, number, number, number];
const identity: Affine = [1, 0, 0, 1, 0, 0];
function multiply(a: Affine, b: Affine): Affine | null {
  const m: Affine = [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  return m.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6) ? m : null;
}
function affine(value: string): Affine | null {
  const re = /(translate|scale|rotate|matrix|skewX|skewY)\(([^)]*)\)/g;
  let end = 0,
    match,
    total: Affine = identity;
  while ((match = re.exec(value))) {
    if (value.slice(end, match.index).trim() || !nums(match[2])) return null;
    const a = match[2]
        .trim()
        .split(/[\s,]+/)
        .map(Number),
      allowed: Record<string, number[]> = {
        translate: [1, 2],
        scale: [1, 2],
        rotate: [1, 3],
        matrix: [6],
        skewX: [1],
        skewY: [1],
      };
    if (!allowed[match[1]].includes(a.length)) return null;
    let next: Affine = identity;
    const radians = (a[0] * Math.PI) / 180;
    if (match[1] === "translate") next = [1, 0, 0, 1, a[0], a[1] ?? 0];
    else if (match[1] === "scale") next = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    else if (match[1] === "matrix") next = a as Affine;
    else if (match[1] === "rotate") {
      const c = Math.cos(radians),
        sin = Math.sin(radians),
        x = a[1] ?? 0,
        y = a[2] ?? 0;
      next = [c, sin, -sin, c, x - c * x + sin * y, y - sin * x - c * y];
    } else if (match[1] === "skewX") next = [1, 0, Math.tan(radians), 1, 0, 0];
    else next = [1, Math.tan(radians), 0, 1, 0, 0];
    const combined = multiply(total, next);
    if (!combined) return null;
    total = combined;
    end = re.lastIndex;
  }
  return end && !value.slice(end).trim() ? total : null;
}
/** Strict declarative vector subset: no markup, URL resources, events, styles or DOM props. */
export function parseRichVector(value: unknown): RichVector | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      JSON.stringify(value).length > 262144
    )
      return null;
    const v = value as RichVector;
    if (
      Object.keys(v).some(
        (k) =>
          !["viewBox", "nodes", "description", "pointer", "inset"].includes(k),
      ) ||
      !Array.isArray(v.viewBox) ||
      v.viewBox.length !== 4 ||
      !v.viewBox.every(finite) ||
      v.viewBox[2] <= 0 ||
      v.viewBox[3] <= 0 ||
      !Array.isArray(v.nodes) ||
      typeof v.description !== "string" ||
      !v.description.trim() ||
      v.description.length > 2000 ||
      (v.pointer !== undefined && typeof v.pointer !== "boolean")
    )
      return null;
    if (
      v.inset !== undefined &&
      (!v.inset ||
        typeof v.inset !== "object" ||
        Object.keys(v.inset).some((k) => !["width", "corner"].includes(k)) ||
        !finite(v.inset.width) ||
        v.inset.width < 120 ||
        v.inset.width > 320 ||
        !["top-right", "top-left", "bottom-right", "bottom-left"].includes(
          v.inset.corner,
        ))
    )
      return null;
    const ids = new Set<string>(),
      refs: string[] = [];
    const references = new Map<string, Set<string>>();
    let count = 0;
    const visit = (
      n: RichVectorNode | string,
      depth: number,
      parent: Affine = identity,
      owners: string[] = [],
    ): boolean => {
      if (++count > 2048 || depth > 16) return false;
      if (typeof n === "string") return n.length <= 500;
      if (
        !n ||
        typeof n !== "object" ||
        Object.keys(n).some((k) => !["tag", "attrs", "children"].includes(k)) ||
        !tags.has(n.tag) ||
        !n.attrs ||
        typeof n.attrs !== "object" ||
        Array.isArray(n.attrs) ||
        !Array.isArray(n.children)
      )
        return false;
      const ownerIds =
        typeof n.attrs.id === "string" ? [...owners, n.attrs.id] : owners;
      const reference = (id: string) => {
        refs.push(id);
        for (const owner of ownerIds) {
          if (!references.has(owner)) references.set(owner, new Set());
          references.get(owner)!.add(id);
        }
      };
      let world = parent;
      if (
        n.tag === "filter" &&
        (n.children.length !== 1 ||
          typeof n.children[0] === "string" ||
          n.children[0].tag !== "feDropShadow")
      )
        return false;
      if (n.tag === "feDropShadow" && n.children.length) return false;
      for (const [k, val] of Object.entries(n.attrs)) {
        if (typeof val !== "string" && typeof val !== "number") return false;
        if (n.tag === "filter" && ["x", "y", "width", "height"].includes(k)) {
          if (typeof val !== "string" || !/^[-+]?\d+(?:\.\d+)?%$/.test(val))
            return false;
          const n = Number(val.slice(0, -1));
          if (n < -50 || n > 200 || (["width", "height"].includes(k) && n <= 0))
            return false;
          continue;
        }
        if (
          k === "stdDeviation" &&
          (!finite(Number(val)) || Number(val) < 0 || Number(val) > 12)
        )
          return false;
        if (
          ["dx", "dy"].includes(k) &&
          (!finite(Number(val)) || Math.abs(Number(val)) > 40)
        )
          return false;
        if (numeric.has(k)) {
          if (typeof val === "string" && /^\d+(?:\.\d+)?%$/.test(val)) {
            if (Number(val.slice(0, -1)) > 100) return false;
          } else if (!finite(Number(val)) || String(val).trim() === "")
            return false;
          const num = Number(val);
          if (
            [
              "r",
              "rx",
              "ry",
              "width",
              "height",
              "fontSize",
              "strokeWidth",
            ].includes(k) &&
            num < 0
          )
            return false;
          if (
            [
              "opacity",
              "strokeOpacity",
              "fillOpacity",
              "stopOpacity",
              "offset",
              "floodOpacity",
            ].includes(k) &&
            !String(val).endsWith("%") &&
            (num < 0 || num > 1)
          )
            return false;
        } else if (colors.has(k)) {
          if (typeof val !== "string") return false;
          if (/^url\(#[A-Za-z][A-Za-z0-9_-]{0,79}\)$/.test(val))
            reference(val.slice(5, -1));
          else if (
            val !== "none" &&
            !/^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(val)
          )
            return false;
        } else if (k === "id") {
          if (!validId(val) || ids.has(String(val))) return false;
          ids.add(String(val));
        } else if (k === "clipPath" || k === "filter") {
          if (
            typeof val !== "string" ||
            !/^url\(#[A-Za-z][A-Za-z0-9_-]{0,79}\)$/.test(val)
          )
            return false;
          reference(val.slice(5, -1));
        } else if (k === "d") {
          if (
            typeof val !== "string" ||
            val.length > 24000 ||
            !/^\s*[Mm]/.test(val) ||
            !/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]+$/.test(val)
          )
            return false;
          const tokens =
            val.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
          if (tokens.length > 8192 || tokens.some((t) => !finite(Number(t))))
            return false;
        } else if (k === "points" || k === "strokeDasharray") {
          if (typeof val !== "string" || !nums(val)) return false;
        } else if (
          k === "transform" ||
          k === "gradientTransform" ||
          k === "patternTransform"
        ) {
          if (typeof val !== "string" || val.length > 1000) return false;
          const matrix = affine(val);
          if (!matrix) return false;
          const combined = multiply(parent, matrix);
          if (!combined) return false;
          if (k === "transform") world = combined;
        } else if (enums[k]) {
          if (!enums[k].includes(String(val))) return false;
        } else return false;
      }
      return n.children.every((c) => visit(c, depth + 1, world, ownerIds));
    };
    if (!v.nodes.every((n) => visit(n, 1)) || refs.some((r) => !ids.has(r)))
      return null;
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const acyclic = (id: string): boolean => {
      if (visiting.has(id)) return false;
      if (visited.has(id)) return true;
      visiting.add(id);
      for (const next of references.get(id) ?? [])
        if (!acyclic(next)) return false;
      visiting.delete(id);
      visited.add(id);
      return true;
    };
    if ([...ids].some((id) => !acyclic(id))) return null;
    return v;
  } catch {
    return null;
  }
}
