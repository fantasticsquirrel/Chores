export type FilterableExploration = {
  title: string;
  summary: string;
  subject: string;
  grade_bands: string[];
  tags: string[];
};
export type DiscoveryFilters = {
  query: string;
  subject: string;
  grade: string;
  tag: string;
};
export const EMPTY_DISCOVERY_FILTERS: DiscoveryFilters = {
  query: "",
  subject: "",
  grade: "",
  tag: "",
};
export function filterExplorations<T extends FilterableExploration>(
  items: T[],
  filters: DiscoveryFilters,
): T[] {
  const words = filters.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items.filter((item) => {
    const text = [item.title, item.summary, item.subject, ...item.tags]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!filters.subject || item.subject === filters.subject) &&
      (!filters.grade || item.grade_bands.includes(filters.grade)) &&
      (!filters.tag || item.tags.includes(filters.tag)) &&
      words.every((word) => text.includes(word))
    );
  });
}
export function discoveryFilterOptions(items: FilterableExploration[]) {
  const distinct = (values: string[]) => [...new Set(values)].sort();
  const gradeOrder = ["K-2", "3-5", "6-8", "9-12"];
  return {
    subjects: distinct(items.map((item) => item.subject)),
    grades: distinct(items.flatMap((item) => item.grade_bands)).sort(
      (a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b),
    ),
    tags: distinct(items.flatMap((item) => item.tags)),
  };
}
