import { HARD_LIMITS, prepareGraph } from "@family-manager/family-tree-core";
import type {
  GraphInput,
  LayoutOptions,
  LayoutResult,
} from "@family-manager/family-tree-core";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object"
    ? (value as RecordValue)
    : {};
}
function scalar(value: unknown): unknown {
  if (value === undefined) return ["undefined"];
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : ["number", String(value)];
  return ["invalid", typeof value];
}
function dateKey(value: unknown): unknown {
  if (value === null || typeof value !== "object") return scalar(value);
  const date = record(value);
  return [scalar(date.value), scalar(date.uncertain), scalar(date.precision)];
}
function arrayKey(
  value: unknown,
  maximum: number,
  fields: (item: RecordValue) => unknown,
): unknown {
  if (!Array.isArray(value)) return ["invalid array", scalar(value)];
  // The scan matches the core hard ceilings. Counts still expose truncation.
  return [
    value.length,
    value
      .slice(0, maximum)
      .map((item) => JSON.stringify(fields(record(item))))
      .sort(),
  ];
}
/** Ignore arbitrary metadata, revision and identity; retain all layout/display facts. */
export function graphPresentationKey(graph: GraphInput): string {
  const input = record(graph);
  return JSON.stringify([
    arrayKey(input.nodes, HARD_LIMITS.maxNodes, (node) => [
      scalar(node.id),
      scalar(node.label),
      dateKey(node.birthDate),
      scalar(node.archived),
      scalar(node.mergedIntoId),
    ]),
    arrayKey(input.edges, HARD_LIMITS.maxEdges, (edge) => [
      scalar(edge.id),
      scalar(edge.type),
      scalar(edge.kind),
      scalar(edge.status),
      ...["source", "target", "parent", "child"].map((key) => [
        key in edge,
        scalar(edge[key]),
      ]),
      dateKey(edge.startDate),
      dateKey(edge.endDate),
    ]),
  ]);
}
function idsKey(value: unknown): unknown {
  return Array.isArray(value)
    ? [value.length, value.slice(0, HARD_LIMITS.maxNodes).map(scalar).sort()]
    : scalar(value);
}
/** Explicit focus/lens context, never the cache revision or graph array identity. */
export function layoutContextKey(
  focus: number | null,
  options: LayoutOptions = {},
): string {
  const input = record(options),
    limits = record(input.limits);
  return JSON.stringify([
    focus,
    ...[
      "ancestorDepth",
      "descendantDepth",
      "includePartners",
      "includeCare",
      "showHistoricalPartners",
      "columnGap",
      "rowGap",
    ].map((key) => scalar(input[key])),
    idsKey(input.collapsedAncestors),
    idsKey(input.collapsedDescendants),
    ...["maxNodes", "maxEdges", "maxIterations"].map((key) =>
      scalar(limits[key]),
    ),
  ]);
}
export function prepareNativeGraph(
  graph: GraphInput,
  options: LayoutOptions = {},
) {
  // Malformed roots are diagnosed by the core, not silently turned into valid empty trees.
  return prepareGraph(record(graph) as unknown as GraphInput, options.limits);
}
export function generationRows(
  layout: LayoutResult,
): { row: number; nodes: LayoutResult["nodes"] }[] {
  const groups = new Map<number, LayoutResult["nodes"][number][]>();
  for (const node of layout.nodes) {
    const group = groups.get(node.row) ?? [];
    group.push(node);
    groups.set(node.row, group);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([row, nodes]) => ({
      row,
      nodes: nodes.sort((a, b) => a.x - b.x || a.node.id - b.node.id),
    }));
}
