import type {
  EdgePattern,
  EdgeRoute,
  LayoutResult,
  Point,
} from "@family-manager/family-tree-core";

export interface TreeViewport {
  x: number;
  y: number;
  scale: number;
}
export const CARD_WIDTH = 216;
export const CARD_HEIGHT = 260;
export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 3;
export const edgeDash: Record<EdgePattern, string | undefined> = {
  solid: undefined,
  double: undefined,
  dashed: "10 6",
  dotted: "2 5",
  "dash-dot": "12 5 2 5",
};
/** Move same-row context lanes above web cards, without changing typed core facts. */
export function displayRoutePoints(route: EdgeRoute): readonly Point[] {
  const first = route.points[0],
    last = route.points[route.points.length - 1];
  if (!first || !last || first.y !== last.y || route.edge.type === "parent")
    return route.points;
  const lane =
    first.y - CARD_HEIGHT / 2 - (route.edge.type === "partner" ? 32 : 20);
  return [first, { x: first.x, y: lane }, { x: last.x, y: lane }, last];
}
export function routeLabelPoint(route: EdgeRoute): Point {
  const points = displayRoutePoints(route);
  if (route.crossRow && points.length >= 4)
    return { x: points[1].x, y: (points[1].y + points[2].y) / 2 - 8 };
  let a = points[0],
    b = points[points.length - 1],
    longest = -1;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1],
      to = points[i];
    const length = Math.abs(to.x - from.x);
    if (from.y === to.y && length > longest) {
      a = from;
      b = to;
      longest = length;
    }
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 };
}
export function treeBounds(layout: LayoutResult) {
  const points = layout.nodes.flatMap((node) => [
    { x: node.x - CARD_WIDTH / 2, y: node.y - CARD_HEIGHT / 2 },
    { x: node.x + CARD_WIDTH / 2, y: node.y + CARD_HEIGHT / 2 },
  ]);
  for (const route of layout.routes) {
    const label = routeLabelPoint(route),
      halfWidth = route.label.length * 3.5;
    points.push(
      ...displayRoutePoints(route),
      { x: label.x - halfWidth, y: label.y - 14 },
      { x: label.x + halfWidth, y: label.y + 4 },
    );
  }
  if (!points.length)
    return {
      left: -CARD_WIDTH / 2,
      top: -CARD_HEIGHT / 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
  const left = Math.min(...points.map((p) => p.x)) - 24;
  const top = Math.min(...points.map((p) => p.y)) - 24;
  return {
    left,
    top,
    width: Math.max(...points.map((p) => p.x)) + 24 - left,
    height: Math.max(...points.map((p) => p.y)) + 24 - top,
  };
}
export function fitViewport(
  layout: LayoutResult,
  width: number,
  height: number,
): TreeViewport {
  const bounds = treeBounds(layout);
  // Fit may be smaller than manual zoom's lower bound for a very wide bounded projection.
  const scale = Math.min(1, width / bounds.width, height / bounds.height);
  return {
    scale,
    x: (width - bounds.width * scale) / 2 - bounds.left * scale,
    y: (height - bounds.height * scale) / 2 - bounds.top * scale,
  };
}
export function zoomViewport(
  current: TreeViewport,
  factor: number,
  width: number,
  height: number,
): TreeViewport {
  const scale = Math.min(
    MAX_ZOOM,
    Math.max(Math.min(MIN_ZOOM, current.scale), current.scale * factor),
  );
  const ratio = scale / current.scale;
  return {
    scale,
    x: width / 2 - (width / 2 - current.x) * ratio,
    y: height / 2 - (height / 2 - current.y) * ratio,
  };
}
