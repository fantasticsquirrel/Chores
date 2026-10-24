import { describe, expect, it } from "vitest";
import type { DiscoveryExploration } from "@family-manager/family-api/models";
import { groupExplorationVersions } from "./catalogGroups";

const original = { id: "gravity", title: "Gravity" } as DiscoveryExploration;
const downloaded = {
  ...original,
  id: "gravity-package",
  package: {
    version: "1.0.0",
    runtime: "worker-rich-v1",
    checksum: "hash",
  },
} as DiscoveryExploration;

describe("catalog version groups", () => {
  it("keeps original bookmarks and an explicit independent package alternative", () => {
    expect(groupExplorationVersions([original, downloaded])).toEqual([
      { item: original, alternatives: [downloaded] },
    ]);
  });
  it("does not manufacture an original when it is disabled or filtered out", () => {
    expect(groupExplorationVersions([downloaded])).toEqual([
      { item: downloaded, alternatives: [] },
    ]);
  });
  it("does not merge packages merely sharing titles or suffixes", () => {
    const other = { ...downloaded, id: "gravity-package-package" };
    expect(groupExplorationVersions([downloaded, other])).toHaveLength(2);
  });
});
