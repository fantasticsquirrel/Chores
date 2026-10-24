import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiClient,
  type Child,
  type HomeschoolAttendance,
  type HomeschoolDayComment,
  type HomeschoolGrade,
  type HomeschoolSemester,
  type HomeschoolSubject,
} from "../../api";
import { formatApiError } from "../../lib/errors";

type HomeschoolData = {
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  attendanceRecords: HomeschoolAttendance[];
  dayComments: HomeschoolDayComment[];
  grades: HomeschoolGrade[];
  loading: boolean;
  error: string | null;
};

const emptyData: HomeschoolData = {
  children: [],
  semesters: [],
  subjects: [],
  attendanceRecords: [],
  dayComments: [],
  grades: [],
  loading: true,
  error: null,
};

export function useHomeschoolData(householdId: number | null): { data: HomeschoolData; refresh: () => Promise<boolean>; applyAttendanceRecord: (record: HomeschoolAttendance) => void } {
  const [snapshot, setSnapshot] = useState<{ householdId: number | null; data: HomeschoolData }>({ householdId, data: emptyData });
  const requestId = useRef(0);
  const latestScope = useRef(householdId);
  latestScope.current = householdId;

  const refresh = useCallback(async (): Promise<boolean> => {
    if (latestScope.current !== householdId) return false;
    const currentRequest = ++requestId.current;
    if (householdId === null) {
      setSnapshot({ householdId, data: { ...emptyData, loading: false, error: "Could not determine household scope." } });
      return false;
    }

    setSnapshot((prev) => ({ householdId, data: { ...(prev.householdId === householdId ? prev.data : emptyData), loading: true, error: null } }));
    try {
      const [children, semesters, subjects, attendanceRecords, dayComments, grades] = await Promise.all([
        apiClient.listChildren({ household_id: householdId }),
        apiClient.listHomeschoolSemesters(householdId),
        apiClient.listHomeschoolSubjects(householdId),
        apiClient.listHomeschoolAttendance(householdId),
        apiClient.listHomeschoolDayComments(householdId),
        apiClient.listHomeschoolGrades(householdId),
      ]);
      if (currentRequest !== requestId.current || latestScope.current !== householdId) return false;
      setSnapshot({ householdId, data: { children, semesters, subjects, attendanceRecords, dayComments, grades, loading: false, error: null } });
      return true;
    } catch (error: unknown) {
      if (currentRequest !== requestId.current || latestScope.current !== householdId) return false;
      setSnapshot((prev) => ({ householdId, data: { ...(prev.householdId === householdId ? prev.data : emptyData), loading: false, error: formatApiError(error) } }));
      return false;
    }
  }, [householdId]);

  useEffect(() => {
    void refresh();
    // Invalidate requests on unmount and before switching household scope.
    return () => { requestId.current += 1; };
  }, [refresh]);

  const applyAttendanceRecord = useCallback((record: HomeschoolAttendance): void => {
    if (householdId === null || latestScope.current !== householdId || record.household_id !== householdId) return;
    requestId.current += 1;
    setSnapshot((previous) => {
      if (previous.householdId !== householdId) return previous;
      return { householdId, data: { ...previous.data, loading: false, attendanceRecords: [
        ...previous.data.attendanceRecords.filter((existing) => !(existing.child_id === record.child_id && existing.subject_id === record.subject_id && existing.date === record.date)),
        record,
      ] } };
    });
  }, [householdId]);

  return { data: snapshot.householdId === householdId ? snapshot.data : emptyData, refresh, applyAttendanceRecord };
}
