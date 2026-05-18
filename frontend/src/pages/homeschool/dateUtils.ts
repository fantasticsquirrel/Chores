export type MonthCell = { iso: string; day: number; inMonth: boolean };

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function isoFromParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function buildMonthGrid(yearMonth: string): MonthCell[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: MonthCell[] = [];

  for (let index = startDay - 1; index >= 0; index -= 1) {
    const day = prevDays - index;
    cells.push({ iso: isoFromParts(year, month - 1, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: isoFromParts(year, month, day), day, inMonth: true });
  }

  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ iso: isoFromParts(year, month + 1, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }

  return cells;
}
