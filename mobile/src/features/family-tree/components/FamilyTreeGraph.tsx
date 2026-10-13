import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  layoutGraph,
  RELATIONSHIP_LEGEND,
} from "@family-manager/family-tree-core";
import type {
  GraphInput,
  LayoutOptions,
  ListRow,
} from "@family-manager/family-tree-core";
import { useTheme } from "../../../theme/ThemeContext";
import {
  graphPresentationKey,
  layoutContextKey,
  prepareNativeGraph,
} from "../lib/presentation/graphPresentation";
import { FamilyTreeButton, FamilyTreeToggle } from "./FamilyTreeControls";
import { FamilyTreePersonCard } from "./FamilyTreePersonCard";
import { FamilyTreeViewport } from "./FamilyTreeViewport";

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
type Direction = "ancestors" | "descendants";
interface LocalLens {
  context: string;
  ancestors: Record<number, boolean>;
  descendants: Record<number, boolean>;
  ancestorExtra: number;
  descendantExtra: number;
  care?: boolean;
  partners?: boolean;
  history?: boolean;
}
const newLens = (context: string): LocalLens => ({
  context,
  ancestors: {},
  descendants: {},
  ancestorExtra: 0,
  descendantExtra: 0,
});
function collapsed(
  base: readonly number[] | undefined,
  overrides: Record<number, boolean>,
): readonly number[] | undefined {
  if (base !== undefined && (!Array.isArray(base) || base.length > 500))
    return base; // Keep invalid-option diagnostics.
  const ids = new Set((base ?? []).slice(0, 500));
  for (const [id, value] of Object.entries(overrides)) {
    if (value) ids.add(Number(id));
    else ids.delete(Number(id));
  }
  return [...ids].sort((a, b) => a - b);
}

/** Native generation-row graph: no web embed, SVG, hidden network or persistence. */
export function FamilyTreeGraph({
  graph,
  focusPersonId,
  graphRevision,
  onSelectPerson,
  onFocusPerson,
  options = {},
  onOptionsChange,
  expansionToken,
  onLoadMore,
  loading = false,
}: FamilyTreeGraphProps) {
  const {
    definition: { colors },
  } = useTheme();
  const context = layoutContextKey(focusPersonId, options);
  const [state, setState] = useState(() => newLens(context));
  const local = state.context === context ? state : newLens(context);
  const [invalidatedToken, setInvalidatedToken] = useState<string | null>(null);
  useEffect(() => {
    if (!expansionToken) setInvalidatedToken(null);
  }, [expansionToken]);
  function optionsFor(lens: LocalLens): LayoutOptions {
    return {
      ...options,
      focusId: focusPersonId ?? undefined,
      includePartners: lens.partners ?? options.includePartners ?? true,
      includeCare: lens.care ?? options.includeCare ?? false,
      showHistoricalPartners:
        lens.history ?? options.showHistoricalPartners ?? false,
      ancestorDepth: (options.ancestorDepth ?? 2) + lens.ancestorExtra,
      descendantDepth: (options.descendantDepth ?? 2) + lens.descendantExtra,
      collapsedAncestors: collapsed(options.collapsedAncestors, lens.ancestors),
      collapsedDescendants: collapsed(
        options.collapsedDescendants,
        lens.descendants,
      ),
    };
  }
  function update(change: (current: LocalLens) => LocalLens) {
    const next = change(local);
    setState(next);
    if (expansionToken) setInvalidatedToken(expansionToken);
    // The owning screen replaces its query lens and clears old continuation.
    // Never execute callbacks inside React's replayable state updater.
    onOptionsChange?.(optionsFor(next));
  }
  const effective = optionsFor(local);
  const graphKey = graphPresentationKey(graph);
  const limitsKey = layoutContextKey(null, { limits: options.limits });
  // Semantic keys intentionally replace incidental projected array identities.
  const prepared = useMemo(
    () => prepareNativeGraph(graph, options),
    [graphKey, limitsKey],
  );
  const lensKey = layoutContextKey(focusPersonId, effective);
  const layout = useMemo(
    () => layoutGraph(prepared, effective),
    [prepared, lensKey],
  );
  const crossRowKeys = useMemo(
    () =>
      new Set(
        layout.routes
          .filter((route) => route.crossRow)
          .map((route) => route.key),
      ),
    [layout],
  );
  const expansions = useMemo(
    () =>
      new Map(
        layout.expansions.map((item) => [
          `${item.personId}:${item.direction}`,
          item,
        ]),
      ),
    [layout],
  );
  const [listOnly, setListOnly] = useState(false);
  const [legend, setLegend] = useState(false);
  const isGraph = layout.mode === "graph" && !listOnly;
  const verticalRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);
  const rowPositions = useRef(new Map<number, number>());
  const personPositions = useRef(new Map<number, number>());
  const fitPending = useRef(true);
  const focus = layout.nodes.find((node) => node.node.id === focusPersonId);
  function fit() {
    if (!isGraph || !focus) return;
    const y = rowPositions.current.get(focus.row),
      x = personPositions.current.get(focus.node.id);
    if (x === undefined || y === undefined) {
      fitPending.current = true;
      return;
    }
    verticalRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
    horizontalRef.current?.scrollTo({ x: Math.max(0, x), animated: false });
    fitPending.current = false;
  }
  useEffect(() => {
    rowPositions.current.clear();
    personPositions.current.clear();
    fitPending.current = true;
    // Fresh native onLayout measurements perform the fit. Never reuse old
    // coordinates across a changed focus/lens. Incidental renders do not fit.
  }, [context, isGraph]);
  function branch(id: number, direction: Direction) {
    const set =
      direction === "ancestors"
        ? effective.collapsedAncestors
        : effective.collapsedDescendants;
    const shut = set?.includes(id) ?? false;
    const depthLimited =
      expansions.get(`${id}:${direction}`)?.reason === "depth";
    update((current) => ({
      ...current,
      [direction]: { ...current[direction], [id]: !shut && !depthLimited },
      ...(depthLimited
        ? direction === "ancestors"
          ? {
              ancestorExtra: Math.min(
                32 - (options.ancestorDepth ?? 2),
                current.ancestorExtra + 1,
              ),
            }
          : {
              descendantExtra: Math.min(
                32 - (options.descendantDepth ?? 2),
                current.descendantExtra + 1,
              ),
            }
        : {}),
    }));
  }
  function card(row: ListRow) {
    const branches =
      layout.mode === "graph"
        ? (["ancestors", "descendants"] as const).flatMap((direction) => {
            const edges =
              direction === "ancestors"
                ? prepared.parents.get(row.node.id)
                : prepared.children.get(row.node.id);
            if (!edges?.length) return [];
            const ids =
              direction === "ancestors"
                ? effective.collapsedAncestors
                : effective.collapsedDescendants;
            const expansion = expansions.get(`${row.node.id}:${direction}`);
            const expand = !!ids?.includes(row.node.id) || !!expansion;
            const limit =
              direction === "ancestors"
                ? effective.ancestorDepth!
                : effective.descendantDepth!;
            return [
              {
                label: `${expand ? "Expand" : "Collapse"} ${direction} of ${row.node.label}`,
                disabled: expansion?.reason === "depth" && limit >= 32,
                onPress: () => branch(row.node.id, direction),
              },
            ];
          })
        : [];
    return (
      <FamilyTreePersonCard
        row={row}
        focusPersonId={focusPersonId}
        names={prepared.nodesById}
        crossRowKeys={crossRowKeys}
        branches={branches}
        onSelectPerson={onSelectPerson}
        onFocusPerson={onFocusPerson}
      />
    );
  }
  return (
    <View style={{ width: "100%", minWidth: 0, gap: 12 }}>
      <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
        Graph revision {graphRevision}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <FamilyTreeButton
          label="Tree"
          selected={isGraph}
          disabled={layout.mode !== "graph"}
          onPress={() => setListOnly(false)}
        />
        <FamilyTreeButton
          label="Relationship list"
          selected={!isGraph}
          onPress={() => setListOnly(true)}
        />
        {isGraph ? <FamilyTreeButton label="Fit" onPress={fit} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <FamilyTreeToggle
          label="Show partnerships"
          checked={effective.includePartners === true}
          onPress={() =>
            update((current) => ({
              ...current,
              partners: !effective.includePartners,
            }))
          }
        />
        {effective.includePartners ? (
          <FamilyTreeToggle
            label="Show historical partnerships"
            checked={effective.showHistoricalPartners === true}
            onPress={() =>
              update((current) => ({
                ...current,
                history: !effective.showHistoricalPartners,
              }))
            }
          />
        ) : null}
        <FamilyTreeToggle
          label="Show care connections"
          checked={effective.includeCare === true}
          onPress={() =>
            update((current) => ({ ...current, care: !effective.includeCare }))
          }
        />
      </View>
      <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
        Care connections do not assert ancestry. Co-parents do not imply a
        partnership.
      </Text>
      {loading ? (
        <Text style={{ color: colors.text, fontSize: 16 }}>
          Loading family tree…
        </Text>
      ) : null}
      {[...new Set(layout.diagnostics.map((item) => item.message))].map(
        (message) => (
          <Text
            key={message}
            style={{ color: colors.warningText, fontSize: 15 }}
          >
            {message}
          </Text>
        ),
      )}
      {layout.truncation.requiresExpansion || expansionToken ? (
        <Text style={{ color: colors.warningText, fontSize: 15 }}>
          Projection is truncated. Only loaded, bounded people and relationships
          are displayed.
        </Text>
      ) : null}
      {layout.mode === "empty" ? (
        !loading && (
          <Text style={{ color: colors.text, fontSize: 16 }}>
            No people in this projection.
          </Text>
        )
      ) : (
        <FamilyTreeViewport
          layout={layout}
          isGraph={isGraph}
          context={context}
          verticalRef={verticalRef}
          horizontalRef={horizontalRef}
          renderCard={card}
          onRowLayout={(row, y) => {
            rowPositions.current.set(row, y);
            if (fitPending.current) fit();
          }}
          onPersonLayout={(id, x) => {
            personPositions.current.set(id, x);
            if (fitPending.current) fit();
          }}
        />
      )}
      {isGraph ? (
        <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
          Scroll rows sideways and vertically. Fit returns the focused person to
          view at readable card size; it does not shrink the whole tree.
        </Text>
      ) : null}
      {expansionToken && expansionToken !== invalidatedToken && onLoadMore ? (
        <FamilyTreeButton
          label="Load more relatives"
          disabled={loading}
          onPress={() => {
            if (!loading) onLoadMore();
          }}
        />
      ) : null}
      <FamilyTreeButton
        label={`${legend ? "Hide" : "Show"} relationship legend`}
        onPress={() => setLegend((value) => !value)}
      />
      {legend ? (
        <View style={{ gap: 6 }}>
          {RELATIONSHIP_LEGEND.map((item, index) => (
            <Text key={index} style={{ color: colors.text, fontSize: 15 }}>
              {item.label} — {item.pattern}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
