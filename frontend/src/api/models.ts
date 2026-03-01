export interface ApiErrorResponse {
  detail?: string;
}

export type UserRole = "PARENT_ADMIN" | "PARENT" | "CHILD";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthUser {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id?: number | null;
}

export interface AuthSessionResponse {
  user: AuthUser;
  csrf_token?: string | null;
}

export interface HealthResponse {
  status: string;
}

export interface ReadinessResponse {
  status: string;
  [key: string]: unknown;
}

export interface Child {
  id: number;
  household_id: number;
  name: string;
  active: boolean;
}

export interface ListChildrenParams {
  household_id: number;
  active_only?: boolean;
}

export interface CreateChildRequest {
  household_id: number;
  name: string;
  active?: boolean;
}

export interface UpdateChildRequest {
  household_id: number;
  name?: string;
  active?: boolean;
}

export interface EligibleChore {
  chore_id: number;
  name: string;
  reward_cents: number;
  occurrence_date: string;
  expires_on?: string | null;
}

export interface ListEligibleChoresParams {
  date: string;
}

export interface SubmissionRequest {
  for_date: string;
  chore_ids: number[];
}

export interface SubmissionItemResponse {
  chore_id: number;
  status: string;
}

export interface SubmissionResponse {
  id: number;
  child_id: number;
  for_date: string;
  status: string;
  items: SubmissionItemResponse[];
}

export interface SubmissionReviewItem {
  id: number;
  chore_id: number;
  chore_name: string;
  chore_reward_cents: number;
  status: string;
}

export interface SubmissionReview {
  id: number;
  child_id: number;
  child_name: string;
  for_date: string;
  status: string;
  items: SubmissionReviewItem[];
}

export interface ListSubmissionsParams {
  status?: string;
}

export interface SubmissionItemDecisionRequest {
  status: "APPROVED" | "REJECTED";
}

export type ScheduleMode = "NONE" | "EVERY" | "AFTER_COMPLETION" | "ONCE";
export type ScheduleUnit = "DAY" | "WEEK" | "MONTH";
export type CompletionMode = "PER_CHILD" | "SHARED";
export type AssignmentMode = "STATIC" | "ROTATING";

export interface Chore {
  id: number;
  household_id: number;
  name: string;
  reward_cents: number;
  reward_dollars: number;
  start_date: string;
  expires_at: string | null;
  timeout_days: number | null;
  schedule_mode: ScheduleMode;
  schedule_interval: number | null;
  schedule_unit: ScheduleUnit | null;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
  archived_at: string | null;
  is_active: boolean;
}

export interface ListChoresParams {
  household_id: number;
  active_only?: boolean;
}

export interface CreateChoreRequest {
  household_id: number;
  name: string;
  reward_cents: number;
  start_date: string;
  expires_at?: string | null;
  timeout_days?: number | null;
  schedule_mode: ScheduleMode;
  schedule_interval?: number | null;
  schedule_unit?: ScheduleUnit | null;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
}

export interface UpdateChoreRequest {
  household_id: number;
  name?: string;
  reward_cents?: number;
  start_date?: string;
  expires_at?: string | null;
  timeout_days?: number | null;
  schedule_mode?: ScheduleMode;
  schedule_interval?: number | null;
  schedule_unit?: ScheduleUnit | null;
  completion_mode?: CompletionMode;
  assignment_mode?: AssignmentMode;
}
