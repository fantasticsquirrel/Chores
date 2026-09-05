import type {
  AssignmentMode,
  CompletionMode,
  CreateChoreRequest,
  ScheduleMode,
  ScheduleUnit,
  UpdateChoreRequest,
} from "../../../api";

export type ChoreFormState = {
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

type NormalizedChoreForm = {
  assignmentMode: AssignmentMode;
  completionMode: CompletionMode;
  expiresAt: string | null;
  name: string;
  rewardCents: number;
  scheduleInterval: number | null;
  scheduleMode: ScheduleMode;
  scheduleUnit: ScheduleUnit | null;
  timeoutDays: number | null;
};

function buildTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildDefaultChoreForm(): ChoreFormState {
  return {
    name: "",
    task_scope: "CHILD",
    reward_dollars: "0.00",
    start_date: buildTodayIsoDate(),
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

function normalizeChoreForm(form: ChoreFormState): NormalizedChoreForm {
  const name = form.name.trim();
  if (name.length === 0) {
    throw new Error("Chore name is required.");
  }

  const rewardCents = Math.round(
    Number.parseFloat(form.reward_dollars || "0") * 100,
  );
  if (!Number.isFinite(rewardCents) || rewardCents < 0) {
    throw new Error("Reward must be a non-negative dollar amount.");
  }

  const timeoutDays = parseOptionalPositiveInteger(
    form.timeout_days,
    "Timeout",
  );
  const needsInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";
  const scheduleInterval = needsInterval
    ? parseOptionalPositiveInteger(form.schedule_interval, "Interval")
    : null;
  if (needsInterval && scheduleInterval === null) {
    throw new Error("Interval is required for repeating schedules.");
  }

  if (form.assignment_mode === "ROTATING" && form.rotation_order.length < 2) {
    throw new Error("Rotation requires at least 2 children.");
  }

  return {
    assignmentMode: form.assignment_mode,
    completionMode: form.completion_mode,
    expiresAt: form.expires_at.trim().length > 0 ? form.expires_at : null,
    name,
    rewardCents,
    scheduleInterval,
    scheduleMode: form.schedule_mode,
    scheduleUnit: scheduleInterval !== null ? form.schedule_unit : null,
    timeoutDays,
  };
}

export function buildCreateChorePayload(
  form: ChoreFormState,
  householdId: number,
  userId: number | null,
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
    schedule_mode: normalized.scheduleMode,
    schedule_interval: normalized.scheduleInterval,
    schedule_unit: normalized.scheduleUnit,
    completion_mode: normalized.completionMode,
    assignment_mode:
      form.task_scope === "PARENT" ? "STATIC" : normalized.assignmentMode,
    allowed_child_ids:
      form.task_scope === "PARENT" || normalized.assignmentMode === "ROTATING"
        ? []
        : form.allowed_child_ids,
    rotation_order:
      form.task_scope === "CHILD" && normalized.assignmentMode === "ROTATING"
        ? form.rotation_order
        : [],
  };
}

export function buildUpdateChorePayload(
  form: ChoreFormState,
  householdId: number,
  userId: number | null,
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
    schedule_mode: normalized.scheduleMode,
    schedule_interval: normalized.scheduleInterval,
    schedule_unit: normalized.scheduleUnit,
    completion_mode: normalized.completionMode,
    assignment_mode: normalized.assignmentMode,
    allowed_child_ids:
      normalized.assignmentMode === "ROTATING" ? null : form.allowed_child_ids,
    rotation_order:
      normalized.assignmentMode === "ROTATING" ? form.rotation_order : null,
  };
}
