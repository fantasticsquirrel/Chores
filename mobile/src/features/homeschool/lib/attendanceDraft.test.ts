import { describe, expect, it } from "vitest";
import { previousAttendanceDay, nextSubjectColor } from "./attendanceDraft";

const record = (child_id: number, date: string, subject_id = 1) => ({
  id: subject_id,
  household_id: 7,
  child_id,
  date,
  subject_id,
  present: false,
  comment: "Reading",
});
describe("attendance drafts", () => {
  it("copies the most recent earlier recorded day, all statuses and subjects, only for this child and household", () => {
    expect(
      previousAttendanceDay(
        [
          record(3, "2026-09-01"),
          record(3, "2026-09-01", 2),
          record(4, "2026-09-05"),
          { ...record(3, "2026-09-06"), household_id: 8 },
          record(3, "2026-09-07"),
        ],
        7,
        3,
        "2026-09-07",
      ),
    ).toEqual([record(3, "2026-09-01"), record(3, "2026-09-01", 2)]);
  });
  it("supports crossing semesters without changing values and handles no history", () => {
    expect(
      previousAttendanceDay([record(3, "2026-06-01")], 7, 3, "2026-09-01")[0]
        .comment,
    ).toBe("Reading");
    expect(previousAttendanceDay([], 7, 3, "2026-09-01")).toEqual([]);
  });
  it("generates an unused swatch", () => {
    const first = nextSubjectColor([]);
    expect(nextSubjectColor([first])).not.toBe(first);
  });
});
