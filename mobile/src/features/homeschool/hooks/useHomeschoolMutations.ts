import type {
  Child,
  HomeschoolDayComment,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { useHomeschoolActionState } from "./useHomeschoolActionState";
import { useHomeschoolRecordMutations } from "./useHomeschoolRecordMutations";
import { useHomeschoolSetupMutations } from "./useHomeschoolSetupMutations";

export function useHomeschoolMutations({
  activeChildren,
  householdId,
  refresh,
  selectedChildComments,
  selectedChildId,
  selectedDate,
  semesters,
  subjects,
  setCalendarYearMonth,
  setSelectedChildId,
  setSelectedDate,
}: {
  activeChildren: Child[];
  householdId: number;
  refresh: () => Promise<void>;
  selectedChildComments: HomeschoolDayComment[];
  selectedChildId: number | null;
  selectedDate: string;
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  setCalendarYearMonth: (yearMonth: string) => void;
  setSelectedChildId: (childId: number | null) => void;
  setSelectedDate: (date: string) => void;
}) {
  const action = useHomeschoolActionState(refresh);
  const sharedAction = {
    clearFeedback: action.clearFeedback,
    householdId,
    runAction: action.runAction,
    setActionError: action.setActionError,
    setActionMessage: action.setActionMessage,
  };
  const setup = useHomeschoolSetupMutations(sharedAction);
  const records = useHomeschoolRecordMutations({
    ...sharedAction,
    activeChildren,
    selectedChildComments,
    selectedChildId,
    selectedDate,
    semesters,
    setCalendarYearMonth,
    setSelectedChildId,
    setSelectedDate,
    subjects,
  });

  return {
    actionError: action.actionError,
    actionMessage: action.actionMessage,
    busy: action.busy,
    ...setup,
    ...records,
  };
}
