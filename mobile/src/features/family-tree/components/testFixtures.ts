import type { GraphInput } from "@family-manager/family-tree-core";
export const family: GraphInput = {
  nodes: [
    { id: 1, label: "Alex", birthDate: { value: "1984", uncertain: true } },
    { id: 2, label: "Morgan" },
    { id: 3, label: "Child" },
    { id: 4, label: "Carer" },
    { id: 5, label: "Past partner" },
  ],
  edges: [
    { id: 1, type: "parent", kind: "biological", source: 1, target: 3 },
    { id: 2, type: "parent", kind: "adoptive", source: 2, target: 3 },
    { id: 3, type: "care", kind: "guardian", source: 4, target: 1 },
    {
      id: 4,
      type: "partner",
      kind: "married",
      status: "ended",
      source: 1,
      target: 5,
    },
  ],
};
