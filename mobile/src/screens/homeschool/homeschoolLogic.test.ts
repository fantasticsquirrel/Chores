import { describe, expect, it } from "vitest";

import type {
  HomeschoolAttendance,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../api/models";
import {
  buildMonthGrid,
  buildSubjectSummaryRows,
  normalizeSubjectColor,
  validateSemesterForm,
} from "./homeschoolLogic";

describe("homeschool mobile logic", () => {
  it("builds a stable six-week month grid with spillover days", () => {
    const grid = buildMonthGrid("2026-06");

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({
      day: 31,
      inMonth: false,
      iso: "2026-05-31",
    });
    expect(grid[1]).toEqual({
      day: 1,
      inMonth: true,
      iso: "2026-06-01",
    });
    expect(grid[41]).toEqual({
      day: 11,
      inMonth: false,
      iso: "2026-07-11",
    });
  });

  it("summarizes attendance and prefers semester grades over overall grades", () => {
    const semester: HomeschoolSemester = {
      active: true,
      end_date: "2026-06-30",
      household_id: 1,
      id: 10,
      name: "June",
      start_date: "2026-06-01",
    };
    const subjects: HomeschoolSubject[] = [
      {
        active: true,
        color: "#3b82f6",
        household_id: 1,
        id: 20,
        name: "Math",
      },
      {
        active: true,
        color: "#14b8a6",
        household_id: 1,
        id: 21,
        name: "Reading",
      },
    ];
    const attendance: HomeschoolAttendance[] = [
      {
        child_id: 3,
        comment: "Fractions",
        date: "2026-06-04",
        household_id: 1,
        id: 1,
        present: true,
        subject_id: 20,
      },
      {
        child_id: 3,
        comment: "Skipped",
        date: "2026-06-05",
        household_id: 1,
        id: 2,
        present: false,
        subject_id: 20,
      },
      {
        child_id: 3,
        comment: "Outside term",
        date: "2026-07-01",
        household_id: 1,
        id: 3,
        present: true,
        subject_id: 21,
      },
    ];
    const grades: HomeschoolGrade[] = [
      {
        child_id: 3,
        grade: "B",
        household_id: 1,
        id: 4,
        semester_id: null,
        subject_id: 20,
      },
      {
        child_id: 3,
        grade: "A",
        household_id: 1,
        id: 5,
        semester_id: 10,
        subject_id: 20,
      },
      {
        child_id: 3,
        grade: "Complete",
        household_id: 1,
        id: 6,
        semester_id: null,
        subject_id: 21,
      },
    ];

    expect(
      buildSubjectSummaryRows({ attendance, grades, semester, subjects }),
    ).toEqual([
      {
        color: "#3b82f6",
        days: 1,
        entries: 1,
        grade: "A",
        name: "Math",
        subjectId: 20,
      },
      {
        color: "#14b8a6",
        days: 0,
        entries: 0,
        grade: "Complete",
        name: "Reading",
        subjectId: 21,
      },
    ]);
  });

  it("validates semester date ranges and normalizes blank subject colors", () => {
    expect(
      validateSemesterForm({
        endDate: "2026-05-31",
        name: "Summer",
        startDate: "2026-06-01",
      }),
    ).toBe("Semester end date must be on or after the start date.");
    expect(
      validateSemesterForm({
        endDate: "2026-06-30",
        name: "Summer",
        startDate: "2026-06-01",
      }),
    ).toBeNull();
    expect(normalizeSubjectColor("  ")).toBe("#3b82f6");
    expect(normalizeSubjectColor(" #f97316 ")).toBe("#f97316");
  });
});
