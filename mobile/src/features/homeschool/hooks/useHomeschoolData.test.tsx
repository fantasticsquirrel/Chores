import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";

import { apiClient } from "../../../api/client";
import type {
  Child,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { useHomeschoolData } from "./useHomeschoolData";

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

function arrangeSuccessfulLoad() {
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
  jest
    .spyOn(apiClient, "listHomeschoolSemesters")
    .mockResolvedValue([semester]);
  jest.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue([subject]);
  jest
    .spyOn(apiClient, "listHomeschoolAttendance")
    .mockResolvedValue([attendance]);
  jest
    .spyOn(apiClient, "listHomeschoolDayComments")
    .mockResolvedValue([comment]);
  jest.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([grade]);
}

describe("useHomeschoolData", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads the household datasets and derives the selected overview", async () => {
    arrangeSuccessfulLoad();

    const { result } = renderHook(() =>
      useHomeschoolData({ enabled: true, householdId: 7 }),
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    await waitFor(() => expect(result.current.selectedChildId).toBe(3));
    expect(apiClient.listChildren).toHaveBeenCalledWith({
      active_only: true,
      household_id: 7,
    });
    expect(apiClient.listHomeschoolSemesters).toHaveBeenCalledWith(7);
    expect(apiClient.listHomeschoolSubjects).toHaveBeenCalledWith(7);
    expect(apiClient.listHomeschoolAttendance).toHaveBeenCalledWith(7);
    expect(apiClient.listHomeschoolDayComments).toHaveBeenCalledWith(7);
    expect(apiClient.listHomeschoolGrades).toHaveBeenCalledWith(7);
    expect(result.current.selectedSemesterId).toBe(4);
    expect(result.current.uniqueAttendanceDays).toBe(1);
    expect(result.current.totalAttendanceEntries).toBe(1);
    expect(result.current.commentsInSemester).toEqual([comment]);
    expect(result.current.subjectRows).toEqual([
      {
        color: "#3b82f6",
        days: 1,
        entries: 1,
        grade: "A",
        name: "Math",
        subjectId: 5,
      },
    ]);
  });

  it("does not load protected data when module access is unavailable", async () => {
    const listChildren = jest.spyOn(apiClient, "listChildren");

    const { result } = renderHook(() =>
      useHomeschoolData({ enabled: false, householdId: 7 }),
    );

    await result.current.refresh();
    expect(listChildren).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ error: null, loading: false });
  });

  it("keeps prior data and exposes load failures", async () => {
    jest
      .spyOn(apiClient, "listChildren")
      .mockRejectedValue(new Error("network unavailable"));
    jest.spyOn(apiClient, "listHomeschoolSemesters").mockResolvedValue([]);
    jest.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue([]);
    jest.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue([]);
    jest.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue([]);
    jest.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([]);

    const { result } = renderHook(() =>
      useHomeschoolData({ enabled: true, householdId: 7 }),
    );

    await waitFor(() =>
      expect(result.current.state.error).toBe("network unavailable"),
    );
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.attendance).toEqual([]);
  });
});
