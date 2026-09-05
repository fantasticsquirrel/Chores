import { describe, expect, it } from "vitest";

import {
  buildDefaultAttendanceForm,
  buildDefaultCommentForm,
  buildDefaultGradeForm,
  buildDefaultSemesterForm,
  buildDefaultSubjectForm,
} from "./defaults";
import {
  knownStringId,
  parseOptionalId,
  parseRequiredId,
  selectKnownId,
} from "./ids";
import {
  validateAttendanceForm,
  validateCommentForm,
  validateGradeForm,
  validateSemesterForm,
  validateSubjectForm,
} from "./validation";

describe("homeschool form helpers", () => {
  it("builds independent defaults from the supplied date", () => {
    expect(buildDefaultSemesterForm("2026-09-05")).toEqual({
      active: true,
      end_date: "2026-09-05",
      name: "",
      start_date: "2026-09-05",
    });
    expect(buildDefaultSubjectForm()).toEqual({
      active: true,
      color: "#3b82f6",
      name: "",
    });
    expect(buildDefaultAttendanceForm("2026-09-05")).toEqual({
      childId: "",
      comment: "",
      date: "2026-09-05",
      present: true,
      subjectId: "",
    });
    expect(buildDefaultCommentForm("2026-09-05")).toEqual({
      childId: "",
      comment: "",
      date: "2026-09-05",
    });
    expect(buildDefaultGradeForm()).toEqual({
      childId: "",
      grade: "",
      semesterId: "",
      subjectId: "",
    });
  });

  it("keeps known IDs, selects fallbacks, and parses payload IDs", () => {
    const rows = [{ id: 4 }, { id: 9 }];

    expect(selectKnownId(9, rows)).toBe(9);
    expect(selectKnownId(12, rows)).toBe(4);
    expect(selectKnownId(null, [])).toBeNull();
    expect(knownStringId("9", rows)).toBe("9");
    expect(knownStringId("12", rows)).toBeNull();
    expect(parseRequiredId("9")).toBe(9);
    expect(parseOptionalId("")).toBeNull();
    expect(parseOptionalId("4")).toBe(4);
  });

  it("preserves validation messages for every form", () => {
    expect(
      validateSemesterForm({ endDate: "bad", name: "Term", startDate: "bad" }),
    ).toBe("Semester dates must use YYYY-MM-DD.");
    expect(
      validateSemesterForm({
        endDate: "2026-08-31",
        name: "Term",
        startDate: "2026-09-01",
      }),
    ).toBe("Semester end date must be on or after the start date.");
    expect(
      validateSubjectForm({ active: true, color: "#fff", name: "  " }),
    ).toBe("Subject name is required.");
    expect(
      validateAttendanceForm({
        childId: "",
        comment: "",
        date: "2026-09-05",
        present: true,
        subjectId: "2",
      }),
    ).toBe("Choose a child and subject first.");
    expect(
      validateCommentForm({ childId: "", comment: "", date: "2026-09-05" }),
    ).toBe("Choose a child first.");
    expect(
      validateGradeForm({
        childId: "3",
        grade: "A",
        semesterId: "",
        subjectId: "",
      }),
    ).toBe("Choose a child and subject first.");
  });
});
