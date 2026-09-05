import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../../../api/client";
import type {
  Child,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { todayDateString } from "../../../utils/date";
import { formatError } from "../../../utils/format";
import { toYearMonth } from "../lib/dates";
import { selectKnownId } from "../lib/ids";
import {
  buildSubjectSummaryRows,
  countUniquePresentDays,
  filterByChild,
} from "../lib/records";

export type HomeschoolDataState = {
  attendance: HomeschoolAttendance[];
  children: Child[];
  comments: HomeschoolDayComment[];
  error: string | null;
  grades: HomeschoolGrade[];
  loading: boolean;
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
};

const emptyState: HomeschoolDataState = {
  attendance: [],
  children: [],
  comments: [],
  error: null,
  grades: [],
  loading: false,
  semesters: [],
  subjects: [],
};

export function useHomeschoolData({
  enabled,
  householdId,
}: {
  enabled: boolean;
  householdId: number;
}) {
  const [state, setState] = useState<HomeschoolDataState>(emptyState);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null,
  );
  const [calendarYearMonth, setCalendarYearMonth] = useState(() =>
    toYearMonth(todayDateString()),
  );
  const [selectedDate, setSelectedDate] = useState(todayDateString);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setState((previous) => ({ ...previous, error: null, loading: true }));
    try {
      const [children, semesters, subjects, attendance, comments, grades] =
        await Promise.all([
          apiClient.listChildren({
            active_only: true,
            household_id: householdId,
          }),
          apiClient.listHomeschoolSemesters(householdId),
          apiClient.listHomeschoolSubjects(householdId),
          apiClient.listHomeschoolAttendance(householdId),
          apiClient.listHomeschoolDayComments(householdId),
          apiClient.listHomeschoolGrades(householdId),
        ]);
      setState({
        attendance,
        children,
        comments,
        error: null,
        grades,
        loading: false,
        semesters,
        subjects,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: formatError(error),
        loading: false,
      }));
    }
  }, [enabled, householdId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeChildren = useMemo(
    () => state.children.filter((child) => child.active),
    [state.children],
  );
  const semesterChoices = useMemo(() => {
    const activeSemesters = state.semesters.filter(
      (semester) => semester.active,
    );
    return activeSemesters.length > 0 ? activeSemesters : state.semesters;
  }, [state.semesters]);

  useEffect(() => {
    setSelectedChildId((current) => selectKnownId(current, activeChildren));
  }, [activeChildren]);

  useEffect(() => {
    setSelectedSemesterId((current) => selectKnownId(current, semesterChoices));
  }, [semesterChoices]);

  const selectedChild =
    selectedChildId === null
      ? null
      : (activeChildren.find((child) => child.id === selectedChildId) ?? null);
  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (state.semesters.find(
          (semester) => semester.id === selectedSemesterId,
        ) ?? null);
  const selectedChildAttendance = useMemo(
    () => filterByChild(state.attendance, selectedChildId),
    [selectedChildId, state.attendance],
  );
  const selectedChildComments = useMemo(
    () => filterByChild(state.comments, selectedChildId),
    [selectedChildId, state.comments],
  );
  const selectedChildGrades = useMemo(
    () => filterByChild(state.grades, selectedChildId),
    [selectedChildId, state.grades],
  );
  const subjectRows = useMemo(
    () =>
      buildSubjectSummaryRows({
        attendance: selectedChildAttendance,
        grades: selectedChildGrades,
        semester: selectedSemester,
        subjects: state.subjects,
      }),
    [
      selectedChildAttendance,
      selectedChildGrades,
      selectedSemester,
      state.subjects,
    ],
  );
  const commentsInSemester = selectedChildComments.filter(
    (comment) =>
      selectedSemester === null ||
      (comment.date >= selectedSemester.start_date &&
        comment.date <= selectedSemester.end_date),
  );
  const uniqueAttendanceDays = countUniquePresentDays(
    selectedChildAttendance,
    selectedSemester,
  );

  return {
    activeChildren,
    calendarYearMonth,
    commentsInSemester,
    refresh,
    selectedChild,
    selectedChildAttendance,
    selectedChildComments,
    selectedChildGrades,
    selectedChildId,
    selectedDate,
    selectedSemester,
    selectedSemesterId,
    semesterChoices,
    setCalendarYearMonth,
    setSelectedChildId,
    setSelectedDate,
    setSelectedSemesterId,
    state,
    subjectRows,
    totalAttendanceEntries: selectedChildAttendance.filter(
      (record) => record.present,
    ).length,
    uniqueAttendanceDays,
  };
}
