export interface ApiErrorResponse {
  detail?: unknown;
}

export type UserRole = "PARENT_ADMIN" | "PARENT" | "CHILD";

export interface HealthResponse {
  status: string;
}

export interface ReadinessResponse {
  status: string;
  [key: string]: unknown;
}
