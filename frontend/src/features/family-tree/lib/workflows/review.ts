import type {
  FamilyTreePersonDetail,
  FamilyTreeStoriesPage,
  FamilyTreeResidencesPage,
} from "../../../../api";
import type { Facts } from "./workflows";
export type ReviewTarget = {
  entity:
    | "person"
    | "story"
    | "residence"
    | "parent"
    | "care"
    | "partner"
    | "storyOrder"
    | "media";
  id: number;
};
export function latestFacts(
  target: ReviewTarget | undefined,
  queries: readonly [readonly unknown[], unknown][],
  minimumRevision = 0,
): Facts | undefined {
  if (!target) return;
  for (const [key, value] of queries) {
    if (!value || typeof value !== "object") continue;
    if (
      target.entity === "media" &&
      key[2] === "media" &&
      key[3] === target.id
    ) {
      if (
        "graph_revision" in value &&
        typeof value.graph_revision === "number" &&
        value.graph_revision >= minimumRevision &&
        "items" in value &&
        Array.isArray(value.items)
      )
        return { references: value.items };
    }
    if (key[2] === "person") {
      const detail = value as FamilyTreePersonDetail;
      if (detail.graph_revision < minimumRevision) continue;
      if (target.entity === "person" && detail.person.id === target.id)
        return { ...detail.person };
      const list =
        target.entity === "parent"
          ? detail.parent_links
          : target.entity === "care"
            ? detail.care_links
            : target.entity === "partner"
              ? detail.partner_episodes
              : [];
      const record = list.find((item) => item.id === target.id);
      if (record) return { ...record };
    }
    if (
      ((target.entity === "story" || target.entity === "storyOrder") &&
        key[2] === "stories") ||
      (target.entity === "residence" && key[2] === "residences")
    ) {
      const data = value as {
        pages: (FamilyTreeStoriesPage | FamilyTreeResidencesPage)[];
      };
      if (
        !data.pages?.length ||
        data.pages.some(
          (page) =>
            page.graph_revision < minimumRevision ||
            page.graph_revision !== data.pages[0].graph_revision,
        )
      )
        continue;
      if (target.entity === "storyOrder" && key[3] === target.id)
        return {
          story_ids: data.pages.flatMap((page) =>
            page.items.map((item) => item.id),
          ),
        };
      for (const page of data.pages ?? []) {
        const record = page.items.find((item) => item.id === target.id);
        if (record) return { ...record };
      }
    }
  }
}
