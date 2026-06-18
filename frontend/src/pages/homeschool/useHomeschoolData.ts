import { useCallback, useEffect, useState } from "react";

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

export function useHomeschoolData(householdId: number | null): { data: HomeschoolData; refresh: () => void } {
  const [data, setData] = useState<HomeschoolData>(emptyData);

  const refresh = useCallback(() => {
    if (householdId === null) {
      setData({ ...emptyData, loading: false, error: "Could not determine household scope." });
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));
    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listHomeschoolSemesters(householdId),
      apiClient.listHomeschoolSubjects(householdId),
      apiClient.listHomeschoolAttendance(householdId),
      apiClient.listHomeschoolDayComments(householdId),
      apiClient.listHomeschoolGrades(householdId),
    ])
      .then(([children, semesters, subjects, attendanceRecords, dayComments, grades]) => {
        setData({ children, semesters, subjects, attendanceRecords, dayComments, grades, loading: false, error: null });
      })
      .catch((error: unknown) => {
        setData({ ...emptyData, loading: false, error: formatApiError(error) });
      });
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, refresh };
}
