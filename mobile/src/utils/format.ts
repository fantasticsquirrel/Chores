import { ApiClientError } from "../api/client";
import type { UserRole } from "../api/models";

export function isParentRole(role: UserRole): boolean {
  return role === "PARENT" || role === "PARENT_ADMIN";
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function formatError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Request failed.";
}

export function formatNullableCount(value: number | null): string {
  return value === null ? "-" : value.toString();
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
