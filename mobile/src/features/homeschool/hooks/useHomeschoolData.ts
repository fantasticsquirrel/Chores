import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [storedState, setState] = useState<HomeschoolDataState>(emptyState);
  const scope = `${householdId}:${enabled}`;
  const scopeRef = useRef(scope);
  const generation = useRef(0);
  const loadedScope = useRef(scope);
  if (scopeRef.current !== scope) {
    scopeRef.current = scope;
    generation.current += 1;
  }
  const state = loadedScope.current === scope ? storedState : emptyState;
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
    const requestScope = `${householdId}:${enabled}`;
    if (scopeRef.current !== requestScope) return;
    const request = ++generation.current;
    if (loadedScope.current !== requestScope) {
      loadedScope.current = requestScope;
      setState({ ...emptyState, loading: true });
    } else
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
      if (generation.current !== request || scopeRef.current !== requestScope)
        return;
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
      if (generation.current !== request || scopeRef.current !== requestScope)
        return;
      setState((previous) => ({
        ...previous,
        error: formatError(error),
        loading: false,
      }));
    }
  }, [enabled, householdId]);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
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

  function applyAttendanceRecord(record: HomeschoolAttendance) {
    if (
      record.household_id !== householdId ||
      scopeRef.current !== `${householdId}:${enabled}`
    )
      return;
    generation.current += 1; // A pending read must not overwrite a newly acknowledged write.
    setState((previous) => ({
      ...previous,
      loading: false,
      attendance: [
        ...previous.attendance.filter(
          (existing) =>
            !(
              existing.child_id === record.child_id &&
              existing.subject_id === record.subject_id &&
              existing.date === record.date
            ),
        ),
        record,
      ],
    }));
  }

  return {
    applyAttendanceRecord,
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
