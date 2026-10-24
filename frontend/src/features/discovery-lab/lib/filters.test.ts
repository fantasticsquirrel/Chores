import {
  discoveryFilterOptions,
  EMPTY_DISCOVERY_FILTERS,
  filterExplorations,
} from "./filters";
const items = [
  {
    title: "Orbit",
    summary: "Falling sideways",
    subject: "Physics",
    grade_bands: ["6-8"],
    tags: ["space", "motion"],
  },
  {
    title: "Gravity",
    summary: "Falling objects",
    subject: "Physics",
    grade_bands: ["3-5", "6-8"],
    tags: ["motion"],
  },
  {
    title: "Leaf",
    summary: "Light into sugar",
    subject: "Biology",
    grade_bands: ["3-5"],
    tags: ["plants"],
  },
];
describe("Discovery filters", () => {
  it("combines all filters with AND and searches each word case-insensitively", () => {
    expect(
      filterExplorations(items, {
        query: "FALLING motion",
        subject: "Physics",
        grade: "3-5",
        tag: "motion",
      }).map((item) => item.title),
    ).toEqual(["Gravity"]);
  });
  it("keeps canonical grade order and derives only visible metadata", () => {
    expect(discoveryFilterOptions(items.slice(1)).grades).toEqual([
      "3-5",
      "6-8",
    ]);
    expect(discoveryFilterOptions(items.slice(1)).tags).not.toContain("space");
  });
  it("does not mutate the source when searching or clearing", () => {
    expect(filterExplorations(items, EMPTY_DISCOVERY_FILTERS)).toEqual(items);
    expect(
      filterExplorations(items, {
        ...EMPTY_DISCOVERY_FILTERS,
        query: "nonexistent",
      }),
    ).toEqual([]);
    expect(items).toHaveLength(3);
  });
});
