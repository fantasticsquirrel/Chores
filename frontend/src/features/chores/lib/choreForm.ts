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
