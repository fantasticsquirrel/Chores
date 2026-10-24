import { describe, expect, it } from "vitest";
import { previousAttendance, nextSubjectColor, subjectColors, isAttendanceDate } from "./attendance";

const row = { id: 1, household_id: 7, child_id: 2, subject_id: 3, date: "2026-08-01", present: false, comment: "Sick" };
describe("attendance defaults", () => {
  it("validates real calendar dates rather than their shape alone", () => {
    for (const value of ["2026-02-31", "2026-99-99", "0000-01-01", "2025-02-29", "wrong", null]) expect(isAttendanceDate(value)).toBe(false);
    expect(isAttendanceDate("2024-02-29")).toBe(true);
  });
  it("copies all entries from the latest prior day for this child and household, including absence", () => {
    expect(previousAttendance([row, { ...row, id: 2, subject_id: 4 }, { ...row, child_id: 9, date: "2026-08-31" }, { ...row, household_id: 8, date: "2026-08-30" }, { ...row, date: "2026-09-01" }], 7, 2, "2026-09-01")).toEqual([row, { ...row, id: 2, subject_id: 4 }]);
  });
  it("does not invent previous attendance", () => {
    expect(previousAttendance([row], 7, 2, "2026-07-31")).toEqual([]);
  });
  it("does not recycle colors when the named palette is exhausted", () => {
    const selected: { color: string }[] = [];
    for (let index = 0; index < 40; index += 1) selected.push({ color: nextSubjectColor(selected) });
    expect(new Set(selected.map((subject) => subject.color)).size).toBe(40);
  });
  it("chooses an unused named color without case-sensitive duplicates", () => {
    expect(nextSubjectColor([{ color: subjectColors[0].value.toUpperCase() }])).toBe(subjectColors[1].value);
  });
});
