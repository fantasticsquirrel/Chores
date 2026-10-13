import type {
  Expansion,
  LayoutOptions,
  PreparedGraph,
} from "@family-manager/family-tree-core";
import { Button } from "../../../ui/Button";

export interface TreeBranchControlsProps {
  personId: number;
  label: string;
  graph: PreparedGraph;
  lens: LayoutOptions;
  expansions: ReadonlyMap<string, Expansion>;
  visibleBranches: ReadonlySet<string>;
  onToggle: (id: number, direction: "ancestors" | "descendants") => void;
  onMore: (direction: "ancestors" | "descendants") => void;
  maxDepth?: number;
  recordedCounts?: { ancestors: number; descendants: number };
  disabled?: boolean;
}
export function TreeBranchControls({
  personId,
  label,
  graph,
  lens,
  expansions,
  visibleBranches,
  onToggle,
  onMore,
  maxDepth = 32,
  recordedCounts,
  disabled = false,
}: TreeBranchControlsProps) {
  return (
    <div className="family-tree-branches">
      {(["ancestors", "descendants"] as const).map((direction) => {
        const links = (
          direction === "ancestors" ? graph.parents : graph.children
        ).get(personId);
        const missing = Math.max(
          0,
          (recordedCounts?.[direction] ?? 0) - (links?.length ?? 0),
        );
        if (!links?.length && !missing) return null;
        const collapsed = (
          direction === "ancestors"
            ? lens.collapsedAncestors
            : lens.collapsedDescendants
        )?.includes(personId);
        const depth =
          (direction === "ancestors"
            ? lens.ancestorDepth
            : lens.descendantDepth) ?? 2;
        const expansion = expansions.get(`${personId}:${direction}`);
        const hasVisibleBranch = visibleBranches.has(
          `${personId}:${direction}`,
        );
        const canShowMore =
          !collapsed && (expansion?.reason === "depth" || missing > 0);
        const count = Math.max(expansion?.count ?? 0, missing);
        if (!hasVisibleBranch && !collapsed && !canShowMore) return null;
        const verb = collapsed ? "Expand" : "Collapse";
        return (
          <div key={direction}>
            {(hasVisibleBranch || collapsed) && (
              <Button
                className="family-tree-control family-tree-branch"
                aria-label={`${verb} ${direction} of ${label}`}
                aria-expanded={!collapsed}
                disabled={disabled}
                onClick={() => onToggle(personId, direction)}
              >
                {verb} {direction}
              </Button>
            )}
            {canShowMore && (
              <Button
                className="family-tree-control family-tree-branch"
                aria-label={`Show more ${direction} of ${label} (${count})`}
                disabled={disabled || depth >= maxDepth}
                onClick={() => onMore(direction)}
              >
                Show more {direction} ({count})
              </Button>
            )}
            {canShowMore && depth >= maxDepth && (
              <small>
                Depth limit reached. Focus on this person to explore another
                bounded branch.
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
