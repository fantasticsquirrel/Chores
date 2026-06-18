import type {
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";

export type HomeschoolTab =
  | "overview"
  | "calendar"
  | "setup"
  | "attendance"
  | "comments"
  | "grades";

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

export type SubjectSummaryRow = {
  color: string;
  days: number;
  entries: number;
  grade: string;
  name: string;
  subjectId: number;
};

export const homeschoolTabOptions: Array<{
  label: string;
  value: HomeschoolTab;
}> = [
  { label: "Overview", value: "overview" },
  { label: "Calendar", value: "calendar" },
  { label: "Setup", value: "setup" },
  { label: "Attend", value: "attendance" },
  { label: "Notes", value: "comments" },
  { label: "Grades", value: "grades" },
];

export const subjectColorSwatches = [
  "#3b82f6",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#64748b",
];

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
    cells.push({ day, inMonth: false, iso: isoFromParts(year, month - 1, day) });
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
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));

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

export function countUniquePresentDays(
  attendance: HomeschoolAttendance[],
  semester: HomeschoolSemester | null,
): number {
  return new Set(
    attendance
      .filter((record) => record.present && isWithinSemester(record.date, semester))
      .map((record) => record.date),
  ).size;
}

export function buildSubjectSummaryRows({
  attendance,
  grades,
  semester,
  subjects,
}: {
  attendance: HomeschoolAttendance[];
  grades: HomeschoolGrade[];
  semester: HomeschoolSemester | null;
  subjects: HomeschoolSubject[];
}): SubjectSummaryRow[] {
  const presentRecords = attendance.filter(
    (record) => record.present && isWithinSemester(record.date, semester),
  );

  return subjects.map((subject) => {
    const subjectRecords = presentRecords.filter(
      (record) => record.subject_id === subject.id,
    );
    return {
      color: subject.color,
      days: new Set(subjectRecords.map((record) => record.date)).size,
      entries: subjectRecords.length,
      grade: findGradeLabel(grades, subject.id, semester),
      name: subject.name,
      subjectId: subject.id,
    };
  });
}

export function filterByChild<T extends { child_id: number }>(
  rows: T[],
  childId: number | null,
): T[] {
  if (childId === null) {
    return [];
  }
  return rows.filter((row) => row.child_id === childId);
}

export function sortDatedRecords<T extends { date: string; id: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((left, right) => {
    const dateComparison = right.date.localeCompare(left.date);
    return dateComparison !== 0 ? dateComparison : right.id - left.id;
  });
}

export function selectKnownId<T extends { id: number }>(
  currentId: number | null,
  rows: T[],
): number | null {
  if (currentId !== null && rows.some((row) => row.id === currentId)) {
    return currentId;
  }
  return rows[0]?.id ?? null;
}

export function normalizeSubjectColor(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "#3b82f6";
}

export function validateSemesterForm({
  endDate,
  name,
  startDate,
}: {
  endDate: string;
  name: string;
  startDate: string;
}): string | null {
  if (name.trim().length === 0) {
    return "Semester name is required.";
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return "Semester dates must use YYYY-MM-DD.";
  }
  if (endDate < startDate) {
    return "Semester end date must be on or after the start date.";
  }
  return null;
}

function findGradeLabel(
  grades: HomeschoolGrade[],
  subjectId: number,
  semester: HomeschoolSemester | null,
): string {
  const semesterGrade =
    semester === null
      ? null
      : grades.find(
          (grade) =>
            grade.subject_id === subjectId && grade.semester_id === semester.id,
        );
  const overallGrade = grades.find(
    (grade) => grade.subject_id === subjectId && grade.semester_id === null,
  );
  return semesterGrade?.grade || overallGrade?.grade || "-";
}

function isWithinSemester(
  date: string,
  semester: HomeschoolSemester | null,
): boolean {
  return (
    semester === null ||
    (date >= semester.start_date && date <= semester.end_date)
  );
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoFromParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
