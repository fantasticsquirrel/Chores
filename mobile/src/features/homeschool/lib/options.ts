export type HomeschoolTab =
  | "overview"
  | "calendar"
  | "setup"
  | "attendance"
  | "comments"
  | "grades";

export const homeschoolTabOptions: Array<{
  label: string;
  value: HomeschoolTab;
}> = [
  { label: "Overview", value: "overview" },
  { label: "Calendar", value: "calendar" },
  { label: "Setup", value: "setup" },
  { label: "Attend", value: "attendance" },
  { label: "Notes", value: "comments" },
  { label: "Grades", value: "grades" },
];

export const subjectColorSwatches = [
  "#3b82f6",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#64748b",
];

export function normalizeSubjectColor(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "#3b82f6";
}
