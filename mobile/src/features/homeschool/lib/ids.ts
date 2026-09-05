export function selectKnownId<T extends { id: number }>(
  currentId: number | null,
  rows: T[],
): number | null {
  if (currentId !== null && rows.some((row) => row.id === currentId)) {
    return currentId;
  }
  return rows[0]?.id ?? null;
}

export function knownStringId<T extends { id: number }>(
  value: string,
  rows: T[],
): string | null {
  if (value !== "" && rows.some((row) => row.id.toString() === value)) {
    return value;
  }
  return null;
}

export function parseRequiredId(value: string): number {
  return Number(value);
}

export function parseOptionalId(value: string): number | null {
  return value === "" ? null : parseRequiredId(value);
}
