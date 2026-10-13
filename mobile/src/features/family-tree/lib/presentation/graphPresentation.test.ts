import { describe, expect, it } from "vitest";
import { layoutGraph, type GraphInput } from "@family-manager/family-tree-core";
import {
  graphPresentationKey,
  layoutContextKey,
  prepareNativeGraph,
  generationRows,
} from "./graphPresentation";
const graph: GraphInput = {
  nodes: [
    { id: 2, label: "Child" },
    { id: 1, label: "Parent" },
  ],
  edges: [{ id: 1, type: "parent", kind: "step", source: 1, target: 2 }],
};
describe("native graph presentation normalization", () => {
  it("keys only visual facts, not cache identities/order/metadata", () => {
    expect(graphPresentationKey(graph)).toBe(
      graphPresentationKey({
        nodes: [...graph.nodes].reverse().map((node) => ({
          ...node,
          metadata: { secret: "not a visual fact" },
        })),
        edges: [...graph.edges],
      }),
    );
    expect(graphPresentationKey(graph)).not.toBe(
      graphPresentationKey({
        ...graph,
        nodes: [{ id: 1, label: "New name" }, graph.nodes[0]],
      }),
    );
  });
  it("does not confuse malformed scalar types with repaired visual facts", () => {
    const broken = {
      ...graph,
      nodes: [{ id: 1, label: Number.NaN }],
    } as unknown as GraphInput;
    expect(graphPresentationKey(broken)).not.toBe(
      graphPresentationKey({ ...graph, nodes: [{ id: 1, label: "NaN" }] }),
    );
  });
  it("keeps relationship kind/history/date changes in the key", () => {
    expect(graphPresentationKey(graph)).not.toBe(
      graphPresentationKey({
        ...graph,
        edges: [
          { id: 1, type: "parent", kind: "adoptive", source: 1, target: 2 },
        ],
      }),
    );
    const partner: GraphInput = {
      ...graph,
      edges: [
        {
          id: 1,
          type: "partner",
          kind: "married",
          status: "current",
          source: 1,
          target: 2,
        },
      ],
    };
    expect(graphPresentationKey(partner)).not.toBe(
      graphPresentationKey({
        ...graph,
        edges: [
          {
            id: 1,
            type: "partner",
            kind: "married",
            status: "ended",
            source: 1,
            target: 2,
          },
        ],
      }),
    );
  });
  it("retains uncertainty and archive/alias visibility in the key", () => {
    expect(graphPresentationKey(graph)).not.toBe(
      graphPresentationKey({
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          birthDate: { value: "1984", uncertain: true },
        })),
      }),
    );
    expect(graphPresentationKey(graph)).not.toBe(
      graphPresentationKey({
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, archived: true })),
      }),
    );
  });
  it("never traverses arbitrary metadata or unbounded input", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() =>
      graphPresentationKey({
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, metadata: circular })),
      }),
    ).not.toThrow();
    const nodes = Array.from({ length: 501 }, (_, i) => ({
      id: i + 1,
      label: `Person ${i + 1}`,
    }));
    const before = graphPresentationKey({ nodes, edges: [] });
    nodes[500] = { id: 501, label: "Outside hard scan" };
    expect(graphPresentationKey({ nodes, edges: [] })).toBe(before);
    expect(
      graphPresentationKey({ nodes: nodes.slice(0, 500), edges: [] }),
    ).not.toBe(before);
  });
  it("separates focus/lens changes but normalizes incidental options identities", () => {
    const a = layoutContextKey(1, {
      includeCare: false,
      collapsedAncestors: [2, 3],
    });
    expect(a).toBe(
      layoutContextKey(1, { collapsedAncestors: [3, 2], includeCare: false }),
    );
    expect(a).not.toBe(
      layoutContextKey(2, { includeCare: false, collapsedAncestors: [2, 3] }),
    );
    expect(a).not.toBe(
      layoutContextKey(1, { includeCare: true, collapsedAncestors: [2, 3] }),
    );
  });
  it("turns malformed root/array input into bounded core diagnostics", () => {
    const prepared = prepareNativeGraph(null as unknown as GraphInput);
    expect(prepared.diagnostics.map((item) => item.code)).toContain(
      "invalid_node",
    );
    expect(layoutGraph(prepared, { focusId: 1 }).mode).toBe("list");
  });
  it("groups deterministic native rows from actual core rank/placement", () => {
    const layout = layoutGraph(graph, { focusId: 2 });
    const rows = generationRows(layout);
    expect(
      rows.map((row) => [row.row, row.nodes.map((node) => node.node.id)]),
    ).toEqual([
      [-1, [1]],
      [0, [2]],
    ]);
    expect(generationRows(layoutGraph({ nodes: [], edges: [] }))).toEqual([]);
  });
});
