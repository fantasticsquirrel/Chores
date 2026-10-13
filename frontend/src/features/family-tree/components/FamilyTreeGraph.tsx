import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  layoutGraph,
  prepareGraph,
  type GraphInput,
  type LayoutOptions,
} from "@family-manager/family-tree-core";
import { Button } from "../../../ui/Button";
import { useTreeLens } from "../lib/presentation/useTreeLens";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  fitViewport,
  zoomViewport,
  type TreeViewport,
} from "../lib/presentation/viewport";
import { TreeBranchControls } from "./TreeBranchControls";
import { TreeEdges } from "./TreeEdges";
import { TreeLegend } from "./TreeLegend";
import { TreeRelationshipList } from "./TreeRelationshipList";
import "./family-tree.css";

export interface FamilyTreeGraphProps {
  graph: GraphInput;
  focusPersonId: number | null;
  graphRevision: number;
  onSelectPerson: (id: number) => void;
  onFocusPerson: (id: number) => void;
  options?: LayoutOptions;
  onOptionsChange?: (options: LayoutOptions) => void;
  expansionToken?: string | null;
  onLoadMore?: () => void;
  loading?: boolean;
}
const DEFAULT_OPTIONS: LayoutOptions = {};

/** Authorized projected data in; presentation callbacks out. No fetching or storage. */
export function FamilyTreeGraph({
  graph,
  focusPersonId,
  graphRevision,
  onSelectPerson,
  onFocusPerson,
  options = DEFAULT_OPTIONS,
  onOptionsChange,
  expansionToken,
  onLoadMore,
  loading = false,
}: FamilyTreeGraphProps) {
  const {
    lens,
    setCare,
    setPartners,
    setHistory,
    moreAncestors,
    moreDescendants,
    toggleBranch,
  } = useTreeLens(options, focusPersonId, onOptionsChange);
  const prepared = useMemo(
    () => prepareGraph(graph, options.limits),
    [graph, options.limits],
  );
  const layout = useMemo(() => layoutGraph(prepared, lens), [prepared, lens]);
  const expansions = useMemo(
    () =>
      new Map(
        layout.expansions.map((expansion) => [
          `${expansion.personId}:${expansion.direction}`,
          expansion,
        ]),
      ),
    [layout],
  );
  const visibleBranches = useMemo(() => {
    const keys = new Set<string>();
    for (const route of layout.routes) {
      if (route.edge.type !== "parent") continue;
      keys.add(`${route.edge.source}:descendants`);
      keys.add(`${route.edge.target}:ancestors`);
    }
    return keys;
  }, [layout]);
  const [listOnly, setListOnly] = useState(false);
  const [viewport, setViewport] = useState<TreeViewport>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const fittedContext = useRef<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const instructionsId = useId();
  // Intentionally excludes revision, array identity, bounds and collapse state.
  const fitContext = `${focusPersonId}:${lens.ancestorDepth}:${lens.descendantDepth}:${lens.includePartners}:${lens.includeCare}:${lens.showHistoricalPartners}:${lens.columnGap}:${lens.rowGap}`;
  const size = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { width: rect?.width || 800, height: rect?.height || 480 };
  }, []);
  const fit = useCallback(() => {
    const { width, height } = size();
    setViewport(fitViewport(layout, width, height));
  }, [layout, size]);
  useEffect(() => {
    if (
      layout.mode === "graph" &&
      !listOnly &&
      fittedContext.current !== fitContext
    ) {
      fit();
      fittedContext.current = fitContext;
    }
  }, [fitContext, layout.mode, listOnly, fit]);
  function pan(x: number, y: number) {
    setViewport((current) => ({
      ...current,
      x: current.x + x,
      y: current.y + y,
    }));
  }
  function zoom(factor: number) {
    const { width, height } = size();
    setViewport((current) => zoomViewport(current, factor, width, height));
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => pan(60, 0),
      ArrowRight: () => pan(-60, 0),
      ArrowUp: () => pan(0, 60),
      ArrowDown: () => pan(0, -60),
      "+": () => zoom(1.2),
      "=": () => zoom(1.2),
      "-": () => zoom(1 / 1.2),
      Home: fit,
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("button, input, select, textarea, a")
    )
      return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = drag.current;
    if (!previous || previous.id !== event.pointerId) return;
    pan(event.clientX - previous.x, event.clientY - previous.y);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }
  function branches(id: number, label: string) {
    return layout.mode === "graph" ? (
      <TreeBranchControls
        personId={id}
        label={label}
        graph={prepared}
        lens={lens}
        expansions={expansions}
        visibleBranches={visibleBranches}
        onToggle={toggleBranch}
        onMore={(direction) =>
          direction === "ancestors" ? moreAncestors() : moreDescendants()
        }
      />
    ) : null;
  }
  const warnings = [
    ...new Set(layout.diagnostics.map((diagnostic) => diagnostic.message)),
  ];
  const bounded = layout.truncation.requiresExpansion || !!expansionToken;

  return (
    <section
      aria-label="Family tree"
      className="family-tree"
      aria-busy={loading}
      data-graph-revision={graphRevision}
    >
      <div className="family-tree-view-controls">
        <Button
          className="family-tree-control"
          aria-pressed={listOnly}
          onClick={() => setListOnly((current) => !current)}
        >
          {listOnly
            ? "Show tree and relationship list"
            : "Relationship list only"}
        </Button>
        <fieldset className="family-tree-filters">
          <legend>View filters</legend>
          <label>
            <input
              type="checkbox"
              checked={lens.includePartners}
              onChange={(event) => setPartners(event.target.checked)}
            />
            Partnerships
          </label>
          <label>
            <input
              type="checkbox"
              checked={lens.showHistoricalPartners}
              disabled={!lens.includePartners}
              onChange={(event) => setHistory(event.target.checked)}
            />
            Historical partnerships
          </label>
          <label>
            <input
              type="checkbox"
              checked={lens.includeCare}
              onChange={(event) => setCare(event.target.checked)}
            />
            Care connections
          </label>
        </fieldset>
      </div>
      {(loading || warnings.length > 0 || bounded) && (
        <div role="status" className="family-tree-notice">
          {loading && (
            <p>
              {layout.list.length
                ? "Updating family tree…"
                : "Loading family tree…"}
            </p>
          )}
          {warnings.length > 0 && (
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {bounded && (
            <p>
              Projection is bounded. Not all people or relationships are shown;
              choose a narrower focus or load an available continuation.
            </p>
          )}
        </div>
      )}
      {layout.mode === "empty" && !loading && (
        <p>No active people in this projection.</p>
      )}
      {layout.mode === "graph" && !listOnly && (
        <>
          <div
            className="family-tree-toolbar"
            role="group"
            aria-label="Tree navigation"
          >
            <Button
              className="family-tree-control"
              aria-label="Zoom in"
              onClick={() => zoom(1.2)}
            >
              Zoom +
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Zoom out"
              onClick={() => zoom(1 / 1.2)}
            >
              Zoom −
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Fit tree"
              onClick={fit}
            >
              Fit
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Pan left"
              onClick={() => pan(60, 0)}
            >
              ←
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Pan right"
              onClick={() => pan(-60, 0)}
            >
              →
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Pan up"
              onClick={() => pan(0, 60)}
            >
              ↑
            </Button>
            <Button
              className="family-tree-control"
              aria-label="Pan down"
              onClick={() => pan(0, -60)}
            >
              ↓
            </Button>
          </div>
          <p id={instructionsId} className="family-tree-instructions">
            Drag the canvas to pan, or use navigation buttons. With the viewport
            focused, use arrow keys to pan, +/− to zoom and Home to fit. Use the
            relationship list for unscaled navigation.
          </p>
          <div
            role="region"
            aria-label="Tree viewport"
            aria-describedby={instructionsId}
            tabIndex={0}
            ref={viewportRef}
            className="family-tree-viewport"
            onKeyDown={keyboard}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerEnd}
            onPointerCancel={pointerEnd}
            onLostPointerCapture={pointerEnd}
          >
            <div
              className="family-tree-world"
              data-tree-transform
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              }}
            >
              <TreeEdges layout={layout} />
              {layout.nodes.map((person) => (
                <article
                  key={person.node.id}
                  className={`family-tree-person${person.node.id === focusPersonId ? " family-tree-person-focused" : ""}${person.birthYear.bucket.kind === "unknown" ? " family-tree-person-unknown" : ""}`}
                  style={{
                    left: person.x - CARD_WIDTH / 2,
                    top: person.y - CARD_HEIGHT / 2,
                  }}
                  aria-label={person.node.label}
                >
                  <Button
                    className="family-tree-control family-tree-person-name"
                    aria-label={`Select ${person.node.label}`}
                    onClick={() => onSelectPerson(person.node.id)}
                  >
                    {person.node.label}
                  </Button>
                  <p>{person.birthYear.label}</p>
                  <Button
                    className="family-tree-control"
                    aria-label={`Show ${person.node.label} in tree`}
                    onClick={() => onFocusPerson(person.node.id)}
                  >
                    Show in tree
                  </Button>
                  {branches(person.node.id, person.node.label)}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
      <TreeLegend />
      <TreeRelationshipList
        layout={layout}
        onSelectPerson={onSelectPerson}
        onFocusPerson={onFocusPerson}
        renderBranches={listOnly ? branches : undefined}
      />
      {expansionToken && onLoadMore && (
        <Button
          className="family-tree-control"
          disabled={loading}
          onClick={onLoadMore}
        >
          Load more people and relationships
        </Button>
      )}
    </section>
  );
}
