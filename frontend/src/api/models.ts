export interface ApiErrorResponse {
  detail?: string;
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
