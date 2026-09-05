import type {
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolSubject,
} from "../../../api/models";

export type MonthCell = {
  day: number;
  inMonth: boolean;
  iso: string;
};

export type CalendarDaySummary = MonthCell & {
  comment: HomeschoolDayComment | null;
  presentCount: number;
  subjectInitials: string[];
};

export function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(undefined, {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
}

export function buildMonthGrid(yearMonth: string): MonthCell[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const previousMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: MonthCell[] = [];

  for (let index = startDay - 1; index >= 0; index -= 1) {
    const day = previousMonthDays - index;
    cells.push({
      day,
      inMonth: false,
      iso: isoFromParts(year, month - 1, day),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, iso: isoFromParts(year, month, day) });
  }

  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      day: nextDay,
      inMonth: false,
      iso: isoFromParts(year, month + 1, nextDay),
    });
    nextDay += 1;
  }

  return cells;
}

export function buildCalendarDaySummaries({
  attendance,
  comments,
  subjects,
  yearMonth,
}: {
  attendance: HomeschoolAttendance[];
  comments: HomeschoolDayComment[];
  subjects: HomeschoolSubject[];
  yearMonth: string;
}): CalendarDaySummary[] {
  const subjectLookup = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );

  return buildMonthGrid(yearMonth).map((cell) => {
    const presentRecords = attendance.filter(
      (record) => record.date === cell.iso && record.present,
    );
    const initials = unique(
      presentRecords.map((record) =>
        (subjectLookup.get(record.subject_id)?.name ?? `S${record.subject_id}`)
          .slice(0, 1)
          .toUpperCase(),
      ),
    ).slice(0, 3);

    return {
      ...cell,
      comment: comments.find((comment) => comment.date === cell.iso) ?? null,
      presentCount: presentRecords.length,
      subjectInitials: initials,
    };
  });
}

function isoFromParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
