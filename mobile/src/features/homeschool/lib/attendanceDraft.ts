import type { HomeschoolAttendance } from "../../../api/models";
import { subjectColorSwatches } from "./options";

export function previousAttendanceDay(
  records: HomeschoolAttendance[],
  householdId: number,
  childId: number,
  date: string,
): HomeschoolAttendance[] {
  const earlier = records.filter(
    (record) =>
      record.household_id === householdId &&
      record.child_id === childId &&
      record.date < date,
  );
  const previousDate = earlier.reduce(
    (latest, record) => (record.date > latest ? record.date : latest),
    "",
  );
  return earlier.filter((record) => record.date === previousDate);
}

export function nextSubjectColor(used: string[]): string {
  const normalized = used.map((color) => color.toLowerCase());
  return (
    subjectColorSwatches.find((color) => !normalized.includes(color)) ??
    subjectColorSwatches[used.length % subjectColorSwatches.length]
  );
}
