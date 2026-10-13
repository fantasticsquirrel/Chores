import { describe, expect, it } from "vitest";
import {
  fieldChanges,
  unionProjection,
  projectionToGraph,
  readAtRevision,
} from "./workflows";
import type { FamilyTreeGraphProjection } from "../../../../api";

const projection = (revision: number): FamilyTreeGraphProjection => ({
  graph_revision: revision,
  focus_person_id: 1,
  nodes: [
    {
      id: 1,
      display_name: "One",
      birth_date: null,
      death_date: null,
      living_status: "unknown" as const,
      is_locked: false,
      expansion_counts: { parents: 0, children: 0, partners: 0, care: 0 },
    },
  ],
  edges: [
    {
      id: "care:1",
      record_id: 1,
      type: "care" as const,
      source_person_id: 1,
      target_person_id: 2,
      kind: "guardian",
      status: null,
      start_date: null,
      end_date: null,
    },
  ],
  truncated: true,
  expansion_token: "next",
  warnings: [],
  projection_limits: {
    max_nodes: 100,
    max_edges: 200,
    hard_max_nodes: 500,
    hard_max_edges: 1000,
  },
});

describe("Family Tree workflow boundaries", () => {
  it("omits untouched fields and sends explicit null only for a touched clear", () => {
    expect(
      fieldChanges(
        { first_name: "One", notes_md: "old", gender: null },
        { first_name: "One", notes_md: null, gender: null },
        new Set(["notes_md"]),
      ),
    ).toEqual({ notes_md: null });
  });
  it("does not send unchanged touched facts or metadata", () => {
    expect(
      fieldChanges(
        { aliases: [{ name: "A", label: null }] },
        { aliases: [{ name: "A", label: null }] },
        new Set(["aliases"]),
      ),
    ).toEqual({});
  });
  it("preserves typed backend edge record IDs and metadata", () => {
    const p = projection(3);
    p.edges.push({
      ...p.edges[0],
      id: "parent:1",
      type: "parent",
      kind: "adoptive",
    } as (typeof p.edges)[number]);
    const graph = projectionToGraph(p);
    expect(graph.edges.map((e) => e.id)).toEqual([1, 1]);
    expect(graph.edges.map((e) => e.metadata)).toEqual(p.edges);
  });
  it("unions continuation by typed ID only at identical revision", () => {
    const a = projection(3),
      b = projection(3);
    b.nodes.push({ ...b.nodes[0], id: 2 });
    expect(unionProjection(a, b).nodes.map((n) => n.id)).toEqual([1, 2]);
    expect(unionProjection(a, b).edges).toHaveLength(1);
    expect(() => unionProjection(a, projection(4))).toThrow(/revision/i);
  });
  it("rejects a pre-mutation read even when its network resolves later", async () => {
    await expect(
      readAtRevision(Promise.resolve({ graph_revision: 3 }), () => 4),
    ).rejects.toThrow(/stale/i);
  });
  it("never inserts persistence or fabricated records", () => {
    expect(
      projectionToGraph({ ...projection(0), nodes: [], edges: [] }).nodes,
    ).toEqual([]);
  });
});
