import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { apiClient } from "../../../api/client";
import type {
  Child,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { useHomeschoolMutations } from "./useHomeschoolMutations";

const child: Child = { active: true, household_id: 7, id: 3, name: "Mia" };
const semester: HomeschoolSemester = {
  active: true,
  end_date: "2026-09-30",
  household_id: 7,
  id: 4,
  name: "Fall",
  start_date: "2026-09-01",
};
const subject: HomeschoolSubject = {
  active: true,
  color: "#3b82f6",
  household_id: 7,
  id: 5,
  name: "Math",
};
const activeChildren = [child];
const semesters = [semester];
const subjects = [subject];
const selectedChildComments: [] = [];
const attendance: HomeschoolAttendance = {
  child_id: 3,
  comment: "Fractions",
  date: "2026-09-05",
  household_id: 7,
  id: 6,
  present: true,
  subject_id: 5,
};
const comment: HomeschoolDayComment = {
  child_id: 3,
  comment: "Library day",
  date: "2026-09-05",
  household_id: 7,
  id: 8,
};
const grade: HomeschoolGrade = {
  child_id: 3,
  grade: "A",
  household_id: 7,
  id: 9,
  semester_id: 4,
  subject_id: 5,
};

function arrangeMutationMocks() {
  jest.spyOn(apiClient, "createHomeschoolSemester").mockResolvedValue(semester);
  jest.spyOn(apiClient, "createHomeschoolSubject").mockResolvedValue(subject);
  jest.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValue({
    child_id: 3,
    comment: "Fractions",
    date: "2026-09-05",
    household_id: 7,
    id: 6,
    present: false,
    subject_id: 5,
  });
  jest.spyOn(apiClient, "upsertHomeschoolDayComment").mockResolvedValue({
    child_id: 3,
    comment: "Library day",
    date: "2026-09-05",
    household_id: 7,
    id: 8,
  });
  jest.spyOn(apiClient, "upsertHomeschoolGrade").mockResolvedValue({
    child_id: 3,
    grade: "A",
    household_id: 7,
    id: 9,
    semester_id: 4,
    subject_id: 5,
  });
}

describe("useHomeschoolMutations", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves create and record payloads across all homeschool forms", async () => {
    arrangeMutationMocks();
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue();
    const { result } = renderHook(() =>
      useHomeschoolMutations({
        activeChildren,
        householdId: 7,
        refresh,
        selectedChildComments,
        selectedChildId: 3,
        selectedDate: "2026-09-05",
        semesters,
        subjects,
        setCalendarYearMonth: jest.fn(),
        setSelectedChildId: jest.fn(),
        setSelectedDate: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(result.current.attendanceForm.childId).toBe("3"),
    );

    act(() => {
      result.current.updateSemesterForm({
        end_date: "2027-01-15",
        name: "  Winter  ",
        start_date: "2027-01-02",
      });
    });
    await act(async () => result.current.saveSemester());
    expect(apiClient.createHomeschoolSemester).toHaveBeenCalledWith({
      active: true,
      end_date: "2027-01-15",
      household_id: 7,
      name: "Winter",
      start_date: "2027-01-02",
    });

    act(() => {
      result.current.updateSubjectForm({ color: "  ", name: "  Science " });
    });
    await act(async () => result.current.saveSubject());
    expect(apiClient.createHomeschoolSubject).toHaveBeenCalledWith({
      active: true,
      color: "#3b82f6",
      household_id: 7,
      name: "Science",
    });

    act(() => {
      result.current.updateAttendanceForm({
        comment: "Fractions",
        date: "2026-09-05",
        present: false,
      });
    });
    await act(async () => result.current.saveAttendance());
    expect(apiClient.upsertHomeschoolAttendance).toHaveBeenCalledWith({
      child_id: 3,
      comment: "Fractions",
      date: "2026-09-05",
      household_id: 7,
      present: false,
      subject_id: 5,
    });
    expect(result.current.attendanceForm.comment).toBe("");

    act(() => {
      result.current.updateCommentForm({
        comment: "Library day",
        date: "2026-09-05",
      });
    });
    await act(async () => result.current.saveComment());
    expect(apiClient.upsertHomeschoolDayComment).toHaveBeenCalledWith({
      child_id: 3,
      comment: "Library day",
      date: "2026-09-05",
      household_id: 7,
    });

    act(() => {
      result.current.updateGradeForm({ grade: "A", semesterId: "4" });
    });
    await act(async () => result.current.saveGrade());
    expect(apiClient.upsertHomeschoolGrade).toHaveBeenCalledWith({
      child_id: 3,
      grade: "A",
      household_id: 7,
      semester_id: 4,
      subject_id: 5,
    });
    expect(refresh).toHaveBeenCalledTimes(5);
    expect(result.current.actionMessage).toBe("Saved grade.");
  });

  it("keeps mutation failures visible and does not refresh", async () => {
    jest
      .spyOn(apiClient, "upsertHomeschoolGrade")
      .mockRejectedValue(new Error("save failed"));
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue();
    const { result } = renderHook(() =>
      useHomeschoolMutations({
        activeChildren,
        householdId: 7,
        refresh,
        selectedChildComments,
        selectedChildId: 3,
        selectedDate: "2026-09-05",
        semesters,
        subjects,
        setCalendarYearMonth: jest.fn(),
        setSelectedChildId: jest.fn(),
        setSelectedDate: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.gradeForm.childId).toBe("3"));
    act(() => result.current.updateGradeForm({ grade: "A" }));
    await act(async () => result.current.saveGrade());

    expect(result.current.actionError).toBe(
      "Homeschool action failed: save failed",
    );
    expect(result.current.busy).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("preserves update and confirmed-delete API contracts", async () => {
    const updatedSemester = { ...semester, name: "Updated Fall" };
    const updatedSubject = { ...subject, color: "#14b8a6", name: "Algebra" };
    const updateSemester = jest
      .spyOn(apiClient, "updateHomeschoolSemester")
      .mockResolvedValue(updatedSemester);
    const updateSubject = jest
      .spyOn(apiClient, "updateHomeschoolSubject")
      .mockResolvedValue(updatedSubject);
    const deleteSemester = jest
      .spyOn(apiClient, "deleteHomeschoolSemester")
      .mockResolvedValue(undefined);
    const deleteSubject = jest
      .spyOn(apiClient, "deleteHomeschoolSubject")
      .mockResolvedValue(undefined);
    const deleteAttendance = jest
      .spyOn(apiClient, "deleteHomeschoolAttendance")
      .mockResolvedValue(undefined);
    const deleteComment = jest
      .spyOn(apiClient, "deleteHomeschoolDayComment")
      .mockResolvedValue(undefined);
    const deleteGrade = jest
      .spyOn(apiClient, "deleteHomeschoolGrade")
      .mockResolvedValue(undefined);
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue();
    const { result } = renderHook(() =>
      useHomeschoolMutations({
        activeChildren,
        householdId: 7,
        refresh,
        selectedChildComments,
        selectedChildId: 3,
        selectedDate: "2026-09-05",
        semesters,
        subjects,
        setCalendarYearMonth: jest.fn(),
        setSelectedChildId: jest.fn(),
        setSelectedDate: jest.fn(),
      }),
    );

    act(() => {
      result.current.editSemester(semester);
      result.current.updateSemesterForm({ name: " Updated Fall " });
    });
    await act(async () => result.current.saveSemester());
    expect(updateSemester).toHaveBeenCalledWith(4, {
      active: true,
      end_date: "2026-09-30",
      household_id: 7,
      name: "Updated Fall",
      start_date: "2026-09-01",
    });

    act(() => {
      result.current.editSubject(subject);
      result.current.updateSubjectForm({ color: " #14b8a6 ", name: "Algebra" });
    });
    await act(async () => result.current.saveSubject());
    expect(updateSubject).toHaveBeenCalledWith(5, {
      active: true,
      color: "#14b8a6",
      household_id: 7,
      name: "Algebra",
    });

    const confirmations = [
      [() => result.current.confirmDeleteSemester(semester), deleteSemester, 4],
      [() => result.current.confirmDeleteSubject(subject), deleteSubject, 5],
      [
        () => result.current.confirmDeleteAttendance(attendance),
        deleteAttendance,
        6,
      ],
      [() => result.current.confirmDeleteComment(comment), deleteComment, 8],
      [() => result.current.confirmDeleteGrade(grade), deleteGrade, 9],
    ] as const;

    for (const [confirm, deleteMethod, id] of confirmations) {
      act(confirm);
      const buttons = alert.mock.calls.at(-1)?.[2];
      act(() => {
        buttons?.[1]?.onPress?.();
      });
      await waitFor(() => expect(deleteMethod).toHaveBeenCalledWith(id, 7));
      await waitFor(() => expect(result.current.busy).toBe(false));
    }
  });
});
