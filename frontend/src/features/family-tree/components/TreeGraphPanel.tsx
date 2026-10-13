import { useMemo } from "react";
import type { LayoutOptions } from "@family-manager/family-tree-core";
import { Button, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { FamilyTreeGraph } from "./FamilyTreeGraph";
import { projectionToGraph } from "../lib/workflows/workflows";
import { useTreeRead } from "../hooks/useTreeReads";
export function TreeGraphPanel({
  graph,
  collection,
  focus,
  options,
  busy,
  expanding,
  online,
  expansionError,
  select,
  showInTree,
  changeLens,
  more,
}: {
  graph: ReturnType<
    typeof useTreeRead<
      Awaited<
        ReturnType<typeof import("../../../api").apiClient.getFamilyTreeGraph>
      >
    >
  >;
  collection: { data?: { active_people_count: number } };
  focus: number | null;
  options: LayoutOptions;
  busy: boolean;
  expanding: boolean;
  online: boolean;
  expansionError: string | null;
  select: (id: number) => void;
  showInTree: (id: number) => void;
  changeLens: (options: LayoutOptions) => void;
  more: () => Promise<void>;
}) {
  const input = useMemo(
    () => (graph.data ? projectionToGraph(graph.data) : null),
    [graph.data],
  );
  const renderOptions = useMemo(
    () => ({ ...options, limits: { maxNodes: 500, maxEdges: 1000 } }),
    [options],
  );
  return (
    <>
      {graph.error ? (
        <InlineNotice variant="error">
          Graph unavailable: {formatApiError(graph.error)}{" "}
          <Button
            disabled={!online || busy}
            onClick={() => void graph.refetch()}
          >
            Retry graph
          </Button>
          <p>The directory still provides access to disconnected people.</p>
        </InlineNotice>
      ) : null}
      {graph.isPending &&
      collection.data &&
      collection.data.active_people_count > 0 ? (
        <p>Loading the selected tree focus…</p>
      ) : null}
      {graph.data && input ? (
        <>
          <FamilyTreeGraph
            graph={input}
            maxDepth={10}
            recordedBranchCounts={
              new Map(
                graph.data.nodes.map((node) => [
                  node.id,
                  {
                    ancestors: node.expansion_counts.parents,
                    descendants: node.expansion_counts.children,
                  },
                ]),
              )
            }
            focusPersonId={graph.data.focus_person_id ?? focus}
            graphRevision={graph.data.graph_revision}
            onSelectPerson={select}
            onFocusPerson={showInTree}
            options={renderOptions}
            onOptionsChange={changeLens}
            expansionToken={graph.data.expansion_token}
            onLoadMore={() => void more()}
            loading={busy || expanding || graph.isFetching}
          />
          {graph.data.warnings.length ? (
            <InlineNotice variant="info">
              {graph.data.warnings.join("; ")}
            </InlineNotice>
          ) : null}
          {graph.data.truncated ? (
            <p>
              Bounded graph projection; some branches are not loaded. Narrow the
              focus or load a continuation when available.
            </p>
          ) : null}
        </>
      ) : null}
      {expansionError ? (
        <InlineNotice variant="error">
          {expansionError}{" "}
          <Button
            disabled={expanding || busy || !online}
            onClick={() => void more()}
          >
            Retry graph continuation
          </Button>
          <Button
            disabled={busy || !online}
            onClick={() => void graph.refetch()}
          >
            Refresh graph from latest revision
          </Button>
        </InlineNotice>
      ) : null}
    </>
  );
}
