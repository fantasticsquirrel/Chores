import type {
  AssignmentMode,
  Child,
  Chore,
  CompletionMode,
  ScheduleMode,
  ScheduleUnit,
} from "../../../api/models";

export type MobileChoreFormState = {
  name: string;
  reward_cents: string;
  start_date: string;
  expires_at: string;
  timeout_days: string;
  schedule_mode: ScheduleMode;
  schedule_interval: string;
  schedule_unit: ScheduleUnit;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
  allowed_child_ids: number[];
  rotation_order: number[];
};

export const scheduleOptions = [
  { label: "On-demand", value: "NONE" },
  { label: "Once", value: "ONCE" },
  { label: "Repeating", value: "EVERY" },
  { label: "After completion", value: "AFTER_COMPLETION" },
] satisfies Array<{ label: string; value: ScheduleMode }>;

export const scheduleUnitOptions = [
  { label: "Days", value: "DAY" },
  { label: "Weeks", value: "WEEK" },
  { label: "Months", value: "MONTH" },
] satisfies Array<{ label: string; value: ScheduleUnit }>;

export const completionOptions = [
  { label: "Per child", value: "PER_CHILD" },
  { label: "Shared", value: "SHARED" },
] satisfies Array<{ label: string; value: CompletionMode }>;

export const assignmentOptions = [
  { label: "Static", value: "STATIC" },
  { label: "Rotating", value: "ROTATING" },
] satisfies Array<{ label: string; value: AssignmentMode }>;

export function buildDefaultChoreForm(startDate: string): MobileChoreFormState {
  return {
    name: "",
    reward_cents: "0",
    start_date: startDate,
    expires_at: "",
    timeout_days: "",
    schedule_mode: "NONE",
    schedule_interval: "1",
    schedule_unit: "WEEK",
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    allowed_child_ids: [],
    rotation_order: [],
  };
}

export function parseOptionalPositiveInteger(value: string, fieldName: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }
  return parsed;
}

export function parseNonNegativeInteger(value: string, fieldName: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be zero or a positive whole number.`);
  }
  return parsed;
}

export function scheduleLabel(chore: Chore): string {
  switch (chore.schedule_mode) {
    case "NONE":
      return "On-demand";
    case "ONCE":
      return `Once on ${chore.start_date}`;
    case "EVERY":
      return `Every ${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""}`;
    case "AFTER_COMPLETION":
      return `${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""} after completion`;
  }
}

export function eligibilityLabel(chore: Chore, children: Child[]): string {
  if (chore.assignment_mode === "ROTATING") {
    const names = chore.rotation_order
      .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
      .join(" then ");
    return `Rotation: ${names || "none set"}`;
  }
  if (chore.allowed_child_ids.length === 0) return "All children";
  return chore.allowed_child_ids
    .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
    .join(", ");
}

export function timingLabel(chore: Chore): string {
  const labels: string[] = [];
  if (chore.expires_at !== null) labels.push(`Ends ${chore.expires_at}`);
  if (chore.timeout_days !== null) {
    labels.push(`Window ${chore.timeout_days} day${chore.timeout_days === 1 ? "" : "s"}`);
  }
  return labels.join(" · ");
}
