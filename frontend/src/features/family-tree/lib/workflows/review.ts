import type {
  FamilyTreePersonDetail,
  FamilyTreeStoriesPage,
  FamilyTreeResidencesPage,
} from "../../../../api";
import { personFacts, type Facts } from "./workflows";
export type ReviewTarget = {
  entity: "person" | "story" | "residence" | "parent" | "care" | "partner";
  id: number;
};
export function latestFacts(
  target: ReviewTarget | undefined,
  queries: readonly [readonly unknown[], unknown][],
): Facts | undefined {
  if (!target) return;
  for (const [key, value] of queries) {
    if (!value || typeof value !== "object") continue;
    if (key[2] === "person") {
      const detail = value as FamilyTreePersonDetail;
      if (target.entity === "person" && detail.person.id === target.id)
        return { ...personFacts(detail.person) };
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
      (target.entity === "story" && key[2] === "stories") ||
      (target.entity === "residence" && key[2] === "residences")
    ) {
      const data = value as {
        pages: (FamilyTreeStoriesPage | FamilyTreeResidencesPage)[];
      };
      for (const page of data.pages ?? []) {
        const record = page.items.find((item) => item.id === target.id);
        if (record) return { ...record };
      }
    }
  }
}
