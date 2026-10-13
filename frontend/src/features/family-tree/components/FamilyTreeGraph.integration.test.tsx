import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FamilyTreeGraph } from "./FamilyTreeGraph";
import type { GraphInput } from "@family-manager/family-tree-core";

describe("Server-bound Family Tree lens integration", () => {
  it("disables ancestor depth actions at the actual server limit, without a dead callback or 422", () => {
    const graph: GraphInput = {
      nodes: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        label: `Person ${i + 1}`,
      })),
      edges: Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        type: "parent" as const,
        kind: "biological" as const,
        source: i + 2,
        target: i + 1,
      })),
    };
    const onOptionsChange = vi.fn();
    render(
      <FamilyTreeGraph
        graph={graph}
        focusPersonId={1}
        graphRevision={3}
        options={{ ancestorDepth: 10, descendantDepth: 0 }}
        maxDepth={10}
        onOptionsChange={onOptionsChange}
        onSelectPerson={vi.fn()}
        onFocusPerson={vi.fn()}
      />,
    );
    const more = screen.getByRole("button", {
      name: "Show more ancestors of Person 11 (1)",
    });
    expect(more).toBeDisabled();
    fireEvent.click(more);
    expect(onOptionsChange).not.toHaveBeenCalled();
  });
  it("offers real expansion for a terminal projected node using recorded server counts", () => {
    const onOptionsChange = vi.fn();
    render(
      <FamilyTreeGraph
        graph={{ nodes: [{ id: 1, label: "Focus" }], edges: [] }}
        focusPersonId={1}
        graphRevision={3}
        options={{ ancestorDepth: 2, descendantDepth: 2 }}
        maxDepth={10}
        recordedBranchCounts={new Map([[1, { ancestors: 1, descendants: 0 }]])}
        onOptionsChange={onOptionsChange}
        onSelectPerson={vi.fn()}
        onFocusPerson={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show more ancestors of Focus (1)" }),
    );
    expect(onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ ancestorDepth: 3 }),
    );
  });
  it("preserves a server-collapsed terminal branch as an explicit expand action", () => {
    const onOptionsChange = vi.fn();
    render(
      <FamilyTreeGraph
        graph={{ nodes: [{ id: 1, label: "Focus" }], edges: [] }}
        focusPersonId={1}
        graphRevision={3}
        options={{ ancestorDepth: 2, collapsedAncestors: [1] }}
        maxDepth={10}
        recordedBranchCounts={new Map([[1, { ancestors: 1, descendants: 0 }]])}
        onOptionsChange={onOptionsChange}
        onSelectPerson={vi.fn()}
        onFocusPerson={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand ancestors of Focus" }),
    );
    expect(onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({ collapsedAncestors: [] }),
    );
  });
});
