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
}: TreeBranchControlsProps) {
  return (
    <div className="family-tree-branches">
      {(["ancestors", "descendants"] as const).map((direction) => {
        const links = (
          direction === "ancestors" ? graph.parents : graph.children
        ).get(personId);
        if (!links?.length) return null;
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
        const canShowMore = expansion?.reason === "depth" && depth < 32;
        if (!hasVisibleBranch && !collapsed && !canShowMore) return null;
        const verb = collapsed ? "Expand" : "Collapse";
        return (
          <div key={direction}>
            {(hasVisibleBranch || collapsed) && (
              <Button
                className="family-tree-control family-tree-branch"
                aria-label={`${verb} ${direction} of ${label}`}
                aria-expanded={!collapsed}
                onClick={() => onToggle(personId, direction)}
              >
                {verb} {direction}
              </Button>
            )}
            {canShowMore && expansion && (
              <Button
                className="family-tree-control family-tree-branch"
                aria-label={`Show more ${direction} of ${label} (${expansion.count})`}
                onClick={() => onMore(direction)}
              >
                Show more {direction} ({expansion.count})
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
