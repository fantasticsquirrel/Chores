import type {
  GraphInput,
  GraphEdge,
  LayoutOptions,
} from "@family-manager/family-tree-core";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import type {
  FamilyTreeGraphProjection,
  FamilyTreeGraphParams,
  FamilyTreePersonInput,
  FamilyTreePerson,
  FamilyTreeGraphNode,
  FamilyTreeGraphEdge as ServerEdge,
} from "../../../../api";

export type Facts = Record<string, unknown>;
export function fieldChanges(
  original: Facts,
  draft: Facts,
  touched: ReadonlySet<string>,
): Facts {
  return Object.fromEntries(
    [...touched]
      .filter(
        (key) => JSON.stringify(original[key]) !== JSON.stringify(draft[key]),
      )
      .map((key) => [key, draft[key]]),
  );
}
export function personName(
  person: Pick<
    FamilyTreePerson,
    | "id"
    | "display_name"
    | "first_name"
    | "middle_name"
    | "last_name"
    | "suffix"
  >,
): string {
  return (
    person.display_name ||
    [person.first_name, person.middle_name, person.last_name, person.suffix]
      .filter(Boolean)
      .join(" ") ||
    `Person ${person.id}`
  );
}
export function personFacts(person?: FamilyTreePerson): FamilyTreePersonInput {
  if (!person) return { living_status: "unknown", aliases: [], tags: [] };
  const {
    first_name,
    middle_name,
    last_name,
    maiden_name,
    suffix,
    display_name,
    gender,
    living_status,
    birth_date,
    death_date,
    birth_place,
    death_place,
    birth_source,
    death_source,
    notes_md,
    source_label,
    source_url,
    tags,
  } = person;
  return {
    first_name,
    middle_name,
    last_name,
    maiden_name,
    suffix,
    display_name,
    gender,
    living_status,
    birth_date,
    death_date,
    birth_place,
    death_place,
    birth_source,
    death_source,
    notes_md,
    source_label,
    source_url,
    tags,
    aliases: person.aliases.map(({ name, label }) => ({ name, label })),
  };
}
export function projectionToGraph(
  projection: FamilyTreeGraphProjection,
): GraphInput<FamilyTreeGraphNode, ServerEdge> {
  const edges: GraphEdge<ServerEdge>[] = projection.edges.map((edge) => {
    const base = {
      id: edge.record_id,
      source: edge.source_person_id,
      target: edge.target_person_id,
      startDate: edge.start_date
        ? { value: edge.start_date.value, uncertain: edge.start_date.uncertain }
        : null,
      endDate: edge.end_date
        ? { value: edge.end_date.value, uncertain: edge.end_date.uncertain }
        : null,
      metadata: edge,
    };
    // Kind is validated at the server; narrow each typed edge without collapsing IDs.
    if (edge.type === "parent")
      return {
        ...base,
        type: "parent",
        kind: edge.kind as "biological" | "adoptive" | "step" | "unknown",
      };
    if (edge.type === "care")
      return {
        ...base,
        type: "care",
        kind: edge.kind as "guardian" | "caregiver",
      };
    return {
      ...base,
      type: "partner",
      kind: edge.kind as "married" | "civil_union" | "partners" | "unknown",
      status: edge.status ?? "unknown",
    };
  });
  return {
    nodes: projection.nodes.map((node) => ({
      id: node.id,
      label: node.display_name,
      birthDate: node.birth_date
        ? { value: node.birth_date.value, uncertain: node.birth_date.uncertain }
        : null,
      metadata: node,
    })),
    edges,
  };
}
export function unionProjection(
  previous: FamilyTreeGraphProjection,
  next: FamilyTreeGraphProjection,
): FamilyTreeGraphProjection {
  if (
    previous.graph_revision !== next.graph_revision ||
    previous.focus_person_id !== next.focus_person_id
  )
    throw new Error(
      "Graph revision or focus changed. Refresh before expanding.",
    );
  const nodes = [
    ...new Map(
      [...previous.nodes, ...next.nodes].map((node) => [node.id, node]),
    ).values(),
  ];
  const edges = [
    ...new Map(
      [...previous.edges, ...next.edges].map((edge) => [
        `${edge.type}:${edge.record_id}`,
        edge,
      ]),
    ).values(),
  ];
  if (
    nodes.length > next.projection_limits.hard_max_nodes ||
    edges.length > next.projection_limits.hard_max_edges
  )
    throw new Error(
      "Graph continuation reached its safety limit. Choose a narrower focus.",
    );
  return { ...next, nodes, edges };
}
export async function readAtRevision<T extends { graph_revision: number }>(
  request: Promise<T>,
  floor: () => number,
): Promise<T> {
  const response = await request;
  if (response.graph_revision < floor())
    throw new Error(
      "Stale response discarded. Refresh to load the current tree.",
    );
  return response;
}
export function graphParams(
  focus: number | null,
  options: LayoutOptions,
): FamilyTreeGraphParams {
  return {
    focus_person_id: focus,
    up_depth: options.ancestorDepth ?? 3,
    down_depth: options.descendantDepth ?? 3,
    include_partners: options.includePartners ?? true,
    include_care: options.includeCare ?? false,
    include_history: options.showHistoricalPartners ?? false,
    collapsed_up_ids: options.collapsedAncestors ?? [],
    collapsed_down_ids: options.collapsedDescendants ?? [],
    max_nodes: 150,
    max_edges: 300,
  };
}
export function abortableRead<T>(
  signal: AbortSignal,
  load: (options: RequestOptions) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) {
    controller.abort();
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  }
  signal.addEventListener("abort", abort, { once: true });
  try {
    return cancellable(
      load({ signal: controller.signal }),
      controller.signal,
    ).finally(() => signal.removeEventListener("abort", abort));
  } catch (error) {
    signal.removeEventListener("abort", abort);
    return Promise.reject(error);
  }
}
export function cancellable<T>(
  request: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  // Also guard publication when a completed request or test seam ignores abort.
  // No retired protected scope may receive the late response.
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Cancelled", "AbortError"));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    request
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
