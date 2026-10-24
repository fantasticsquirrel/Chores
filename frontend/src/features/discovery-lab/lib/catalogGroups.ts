import type { DiscoveryExploration } from "@family-manager/family-api/models";

/** Presentation only: both entries must already have passed backend access checks. */
export function groupExplorationVersions(items: DiscoveryExploration[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const alternatives = new Map<string, DiscoveryExploration[]>();
  const grouped = new Set<string>();
  for (const item of items) {
    if (!item.package || !item.id.endsWith("-package")) continue;
    const originalId = item.id.slice(0, -"-package".length);
    const original = byId.get(originalId);
    // Never infer access to an absent original or combine two downloaded packages.
    if (!original || original.package) continue;
    alternatives.set(originalId, [
      ...(alternatives.get(originalId) ?? []),
      item,
    ]);
    grouped.add(item.id);
  }
  return items
    .filter((item) => !grouped.has(item.id))
    .map((item) => ({
      item,
      alternatives: alternatives.get(item.id) ?? [],
    }));
}
