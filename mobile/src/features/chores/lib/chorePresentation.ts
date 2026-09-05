import type {
  AssignmentMode,
  Child,
  Chore,
  CompletionMode,
  CreateChoreRequest,
  EligibleChore,
  ScheduleMode,
  ScheduleUnit,
  UpdateChoreRequest,
} from "../../../api/models";

export type MobileChoreFormState = {
  name: string;
  task_scope: "CHILD" | "PARENT";
  reward_dollars: string;
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
    task_scope: "CHILD",
    reward_dollars: "0.00",
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

export function buildEditChoreForm(chore: Chore): MobileChoreFormState {
  return {
    name: chore.name,
    task_scope: chore.owner_user_id === null ? "CHILD" : "PARENT",
    reward_dollars: (chore.reward_cents / 100).toFixed(2),
    start_date: chore.start_date,
    expires_at: chore.expires_at ?? "",
    timeout_days: chore.timeout_days?.toString() ?? "",
    schedule_mode: chore.schedule_mode,
    schedule_interval: String(chore.schedule_interval ?? 1),
    schedule_unit: chore.schedule_unit ?? "WEEK",
    completion_mode: chore.completion_mode,
    assignment_mode: chore.assignment_mode,
    allowed_child_ids: chore.allowed_child_ids,
    rotation_order: chore.rotation_order,
  };
}

export function parseOptionalPositiveInteger(
  value: string,
  fieldName: string,
): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }
  return parsed;
}

type NormalizedChoreForm = {
  expiresAt: string | null;
  name: string;
  rewardCents: number;
  scheduleInterval: number | null;
  scheduleUnit: ScheduleUnit | null;
  timeoutDays: number | null;
};

function normalizeChoreForm(form: MobileChoreFormState): NormalizedChoreForm {
  const name = form.name.trim();
  if (name.length === 0) {
    throw new Error("Chore name is required.");
  }

  const timeoutDays = parseOptionalPositiveInteger(
    form.timeout_days,
    "Timeout",
  );
  const showInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";
  const scheduleInterval = showInterval
    ? parseOptionalPositiveInteger(form.schedule_interval, "Interval")
    : null;
  if (showInterval && scheduleInterval === null) {
    throw new Error("Interval is required for repeating schedules.");
  }

  if (form.assignment_mode === "ROTATING" && form.rotation_order.length < 2) {
    throw new Error("Rotation requires at least 2 children.");
  }

  const rewardCents = Math.round(
    Number.parseFloat(form.reward_dollars || "0") * 100,
  );
  if (!Number.isFinite(rewardCents) || rewardCents < 0) {
    throw new Error("Reward must be a non-negative amount.");
  }

  return {
    expiresAt: form.expires_at.trim().length > 0 ? form.expires_at : null,
    name,
    rewardCents,
    scheduleInterval,
    scheduleUnit: scheduleInterval !== null ? form.schedule_unit : null,
    timeoutDays,
  };
}

export function buildCreateChoreRequest(
  form: MobileChoreFormState,
  householdId: number,
  userId: number,
): CreateChoreRequest {
  const normalized = normalizeChoreForm(form);
  return {
    household_id: householdId,
    owner_user_id: form.task_scope === "PARENT" ? userId : null,
    name: normalized.name,
    reward_cents: form.task_scope === "PARENT" ? 0 : normalized.rewardCents,
    start_date: form.start_date,
    expires_at: normalized.expiresAt,
    timeout_days: normalized.timeoutDays,
    schedule_mode: form.schedule_mode,
    schedule_interval: normalized.scheduleInterval,
    schedule_unit: normalized.scheduleUnit,
    completion_mode: form.completion_mode,
    assignment_mode:
      form.task_scope === "PARENT" ? "STATIC" : form.assignment_mode,
    allowed_child_ids:
      form.task_scope === "PARENT" || form.assignment_mode === "ROTATING"
        ? []
        : form.allowed_child_ids,
    rotation_order:
      form.task_scope === "CHILD" && form.assignment_mode === "ROTATING"
        ? form.rotation_order
        : [],
  };
}

export function buildUpdateChoreRequest(
  form: MobileChoreFormState,
  householdId: number,
  userId: number,
): UpdateChoreRequest {
  const normalized = normalizeChoreForm(form);
  return {
    household_id: householdId,
    owner_user_id: form.task_scope === "PARENT" ? userId : null,
    name: normalized.name,
    reward_cents: form.task_scope === "PARENT" ? 0 : normalized.rewardCents,
    start_date: form.start_date,
    expires_at: normalized.expiresAt,
    timeout_days: normalized.timeoutDays,
    schedule_mode: form.schedule_mode,
    schedule_interval: normalized.scheduleInterval,
    schedule_unit: normalized.scheduleUnit,
    completion_mode: form.completion_mode,
    assignment_mode:
      form.task_scope === "PARENT" ? "STATIC" : form.assignment_mode,
    allowed_child_ids:
      form.assignment_mode === "ROTATING" ? null : form.allowed_child_ids,
    rotation_order:
      form.assignment_mode === "ROTATING" ? form.rotation_order : null,
  };
}

export function showScheduleInterval(form: MobileChoreFormState): boolean {
  return (
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION"
  );
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
    labels.push(
      `Window ${chore.timeout_days} day${chore.timeout_days === 1 ? "" : "s"}`,
    );
  }
  return labels.join(" · ");
}

export function eligibleTimingLabel(chore: EligibleChore): string {
  return `Due ${chore.occurrence_date}${
    chore.expires_on ? ` · Ends ${chore.expires_on}` : ""
  }`;
}

export function completionLabel(chore: Chore): string {
  return chore.completion_mode === "SHARED" ? "Shared" : "Per child";
}

export function rewardLabel(chore: Chore): string {
  return chore.owner_user_id === null
    ? `Reward $${(chore.reward_cents / 100).toFixed(2)}`
    : "Personal parent to-do · no finance";
}
