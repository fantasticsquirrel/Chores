import { useMemo, useState } from "react";
import type { LayoutOptions } from "@family-manager/family-tree-core";
const EMPTY_IDS: readonly number[] = [];
function webSpacing(value: number | undefined, minimum: number) {
  if (value === undefined) return minimum;
  // Preserve invalid values for the core's diagnosed safe fallback; only valid
  // compact gaps are widened to the actual HTML card dimensions.
  return Number.isFinite(value) && value >= 1 && value <= 10000
    ? Math.max(minimum, value)
    : value;
}

function useFlag(
  base: boolean | undefined,
  fallback: boolean,
  controlled: boolean,
) {
  const [local, setLocal] = useState<{
    base: boolean | undefined;
    value: boolean;
  }>();
  return [
    !controlled && local && local.base === base
      ? local.value
      : (base ?? fallback),
    (value: boolean) => setLocal({ base, value }),
  ] as const;
}
function useDepth(
  base: number | undefined,
  focus: number | null,
  controlled: boolean,
  maxDepth: number,
) {
  const [local, setLocal] = useState<{
    base: number | undefined;
    focus: number | null;
    value: number;
  }>();
  const value =
    !controlled && local && local.base === base && local.focus === focus
      ? local.value
      : (base ?? 2);
  return [
    value,
    () => setLocal({ base, focus, value: Math.min(maxDepth, value + 1) }),
  ] as const;
}
function collapseSignature(ids: readonly number[] | undefined) {
  return Array.isArray(ids)
    ? `${ids.length}:${JSON.stringify(ids.slice(0, 500).map((id) => (typeof id === "number" ? id : "invalid")))}`
    : `not-an-array:${typeof ids}`;
}
/** Controlled server lens when callback exists; otherwise ephemeral local presentation. */
export function useTreeLens(
  options: LayoutOptions,
  focus: number | null,
  onOptionsChange?: (options: LayoutOptions) => void,
  maxDepth = 32,
) {
  const controlled = !!onOptionsChange;
  const [includeCare, localCare] = useFlag(
    options.includeCare,
    false,
    controlled,
  );
  const [includePartners, localPartners] = useFlag(
    options.includePartners,
    true,
    controlled,
  );
  const [showHistoricalPartners, localHistory] = useFlag(
    options.showHistoricalPartners,
    false,
    controlled,
  );
  const [ancestorDepth, localMoreAncestors] = useDepth(
    options.ancestorDepth,
    focus,
    controlled,
    maxDepth,
  );
  const [descendantDepth, localMoreDescendants] = useDepth(
    options.descendantDepth,
    focus,
    controlled,
    maxDepth,
  );
  const collapseKey = `${focus}:${collapseSignature(options.collapsedAncestors)}:${collapseSignature(options.collapsedDescendants)}`;
  const [collapse, setCollapse] = useState<{
    key: string;
    ancestors: readonly number[];
    descendants: readonly number[];
  }>();
  const ancestors =
    !controlled && collapse?.key === collapseKey
      ? collapse.ancestors
      : options.collapsedAncestors === undefined
        ? EMPTY_IDS
        : options.collapsedAncestors;
  const descendants =
    !controlled && collapse?.key === collapseKey
      ? collapse.descendants
      : options.collapsedDescendants === undefined
        ? EMPTY_IDS
        : options.collapsedDescendants;
  const lens = useMemo<LayoutOptions>(
    () => ({
      ...options,
      focusId: focus ?? undefined,
      includeCare,
      includePartners,
      showHistoricalPartners,
      ancestorDepth,
      descendantDepth,
      collapsedAncestors: ancestors,
      collapsedDescendants: descendants,
      columnGap: webSpacing(options.columnGap, 280),
      rowGap: webSpacing(options.rowGap, 320),
    }),
    [
      options,
      focus,
      includeCare,
      includePartners,
      showHistoricalPartners,
      ancestorDepth,
      descendantDepth,
      ancestors,
      descendants,
    ],
  );
  function toggleBranch(id: number, direction: "ancestors" | "descendants") {
    const current = direction === "ancestors" ? ancestors : descendants;
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id].slice(0, 500);
    if (onOptionsChange)
      onOptionsChange({
        ...lens,
        [direction === "ancestors"
          ? "collapsedAncestors"
          : "collapsedDescendants"]: next,
      });
    else
      setCollapse({
        key: collapseKey,
        ancestors: direction === "ancestors" ? next : ancestors,
        descendants: direction === "descendants" ? next : descendants,
      });
  }
  return {
    lens,
    toggleBranch,
    setCare: (value: boolean) =>
      onOptionsChange
        ? onOptionsChange({ ...lens, includeCare: value })
        : localCare(value),
    setPartners: (value: boolean) =>
      onOptionsChange
        ? onOptionsChange({ ...lens, includePartners: value })
        : localPartners(value),
    setHistory: (value: boolean) =>
      onOptionsChange
        ? onOptionsChange({ ...lens, showHistoricalPartners: value })
        : localHistory(value),
    moreAncestors: () =>
      onOptionsChange
        ? onOptionsChange({
            ...lens,
            ancestorDepth: Math.min(maxDepth, ancestorDepth + 1),
          })
        : localMoreAncestors(),
    moreDescendants: () =>
      onOptionsChange
        ? onOptionsChange({
            ...lens,
            descendantDepth: Math.min(maxDepth, descendantDepth + 1),
          })
        : localMoreDescendants(),
  };
}
