import type * as FT from "@family-manager/family-api/models";
import type {
  GraphInput,
  GraphEdge,
  LayoutOptions,
} from "@family-manager/family-tree-core";
export function personName(
  person: Pick<
    FT.FamilyTreePerson,
    | "id"
    | "display_name"
    | "first_name"
    | "middle_name"
    | "last_name"
    | "suffix"
  >,
) {
  return (
    person.display_name ||
    [person.first_name, person.middle_name, person.last_name, person.suffix]
      .filter(Boolean)
      .join(" ") ||
    `Person #${person.id}`
  );
}
export function dateLabel(date: FT.FamilyTreePartialDate | null) {
  return date
    ? `${date.value}${date.uncertain ? " (uncertain)" : ""}`
    : "Unknown";
}
export function projectionInput(
  graph: FT.FamilyTreeGraphProjection,
): GraphInput {
  return {
    nodes: graph.nodes.map((p) => ({
      id: p.id,
      label: p.display_name,
      birthDate: p.birth_date
        ? { value: p.birth_date.value, uncertain: p.birth_date.uncertain }
        : null,
      metadata: p,
    })),
    edges: graph.edges.map(
      (e) =>
        ({
          id: e.record_id,
          source: e.source_person_id,
          target: e.target_person_id,
          type: e.type,
          kind: e.kind,
          status: e.status ?? "unknown",
          startDate: e.start_date
            ? { value: e.start_date.value, uncertain: e.start_date.uncertain }
            : null,
          endDate: e.end_date
            ? { value: e.end_date.value, uncertain: e.end_date.uncertain }
            : null,
          metadata: e,
        }) as GraphEdge,
    ),
  };
}
export function lensParams(options: LayoutOptions): FT.FamilyTreeGraphParams {
  return {
    up_depth: options.ancestorDepth,
    down_depth: options.descendantDepth,
    include_partners: options.includePartners,
    include_history: options.showHistoricalPartners,
    include_care: options.includeCare,
    collapsed_up_ids: options.collapsedAncestors,
    collapsed_down_ids: options.collapsedDescendants,
  };
}
// Backend graph defaults: parent depth 2, child depth 2, partners yes,
// historical partnerships no, care no. Preserve omitted defaults on first fetch.
export const initialLens: LayoutOptions = {
  ancestorDepth: 2,
  descendantDepth: 2,
  includePartners: true,
  showHistoricalPartners: false,
  includeCare: false,
};
