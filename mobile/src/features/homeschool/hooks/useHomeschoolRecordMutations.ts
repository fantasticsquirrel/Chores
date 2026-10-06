import { useEffect, useState } from "react";
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
import { todayDateString } from "../../../utils/date";
import { useModuleAccess } from "../../../modules/ModuleAccessContext";
import { toYearMonth } from "../lib/dates";
import {
  buildDefaultAttendanceForm,
  buildDefaultCommentForm,
  buildDefaultGradeForm,
  type AttendanceFormState,
  type DayCommentFormState,
  type GradeFormState,
} from "../lib/defaults";
import { knownStringId, parseOptionalId, parseRequiredId } from "../lib/ids";
import {
  validateAttendanceForm,
  validateCommentForm,
  validateGradeForm,
} from "../lib/validation";
import type { RunHomeschoolAction } from "./useHomeschoolActionState";

export function useHomeschoolRecordMutations({
  activeChildren,
  clearFeedback,
  householdId,
  runAction,
  selectedChildComments,
  selectedChildId,
  selectedDate,
  semesters,
  setActionError,
  setActionMessage,
  setCalendarYearMonth,
  setSelectedChildId,
  setSelectedDate,
  subjects,
}: {
  activeChildren: Child[];
  clearFeedback: () => void;
  householdId: number;
  runAction: RunHomeschoolAction;
  selectedChildComments: HomeschoolDayComment[];
  selectedChildId: number | null;
  selectedDate: string;
  semesters: HomeschoolSemester[];
  setActionError: (message: string | null) => void;
  setActionMessage: (message: string | null) => void;
  setCalendarYearMonth: (yearMonth: string) => void;
  setSelectedChildId: (childId: number | null) => void;
  setSelectedDate: (date: string) => void;
  subjects: HomeschoolSubject[];
}) {
  const { canManageRef } = useModuleAccess();
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>(
    () => buildDefaultAttendanceForm(todayDateString()),
  );
  const [commentForm, setCommentForm] = useState<DayCommentFormState>(() =>
    buildDefaultCommentForm(todayDateString()),
  );
  const [gradeForm, setGradeForm] = useState<GradeFormState>(
    buildDefaultGradeForm,
  );

  useEffect(() => {
    const defaultChildId =
      selectedChildId?.toString() ?? activeChildren[0]?.id.toString() ?? "";
    const defaultSubjectId = subjects[0]?.id.toString() ?? "";

    setAttendanceForm((previous) => ({
      ...previous,
      childId:
        knownStringId(previous.childId, activeChildren) ?? defaultChildId,
      subjectId:
        knownStringId(previous.subjectId, subjects) ?? defaultSubjectId,
    }));
    setCommentForm((previous) => ({
      ...previous,
      childId:
        knownStringId(previous.childId, activeChildren) ?? defaultChildId,
    }));
    setGradeForm((previous) => ({
      ...previous,
      childId:
        knownStringId(previous.childId, activeChildren) ?? defaultChildId,
      semesterId:
        previous.semesterId === "" ||
        semesters.some(
          (semester) => semester.id.toString() === previous.semesterId,
        )
          ? previous.semesterId
          : "",
      subjectId:
        knownStringId(previous.subjectId, subjects) ?? defaultSubjectId,
    }));
  }, [activeChildren, selectedChildId, semesters, subjects]);

  function updateAttendanceForm(patch: Partial<AttendanceFormState>) {
    setAttendanceForm((previous) => ({ ...previous, ...patch }));
  }

  function updateCommentForm(patch: Partial<DayCommentFormState>) {
    setCommentForm((previous) => ({ ...previous, ...patch }));
  }

  function updateGradeForm(patch: Partial<GradeFormState>) {
    setGradeForm((previous) => ({ ...previous, ...patch }));
  }

  async function saveAttendance() {
    if (!canManageRef.current) return;
    const validation = validateAttendanceForm(attendanceForm);
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    await runAction(
      "attendance",
      "Saved attendance.",
      async () => {
        await apiClient.upsertHomeschoolAttendance({
          child_id: parseRequiredId(attendanceForm.childId),
          comment: attendanceForm.comment,
          date: attendanceForm.date,
          household_id: householdId,
          present: attendanceForm.present,
          subject_id: parseRequiredId(attendanceForm.subjectId),
        });
      },
      () => {
        setAttendanceForm((previous) => ({ ...previous, comment: "" }));
      },
    );
  }

  function editAttendance(record: HomeschoolAttendance) {
    if (!canManageRef.current) return;
    setSelectedChildId(record.child_id);
    setSelectedDate(record.date);
    setCalendarYearMonth(toYearMonth(record.date));
    setAttendanceForm({
      childId: record.child_id.toString(),
      comment: record.comment,
      date: record.date,
      present: record.present,
      subjectId: record.subject_id.toString(),
    });
    clearFeedback();
  }

  function confirmDeleteAttendance(record: HomeschoolAttendance) {
    if (!canManageRef.current) return;
    Alert.alert(
      "Delete attendance?",
      "This attendance entry will be removed.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            if (!canManageRef.current) return;
            void deleteAttendance(record);
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  async function deleteAttendance(record: HomeschoolAttendance) {
    if (!canManageRef.current) return;
    await runAction("delete", "Deleted attendance.", async () => {
      await apiClient.deleteHomeschoolAttendance(record.id, householdId);
    });
  }

  async function saveComment() {
    if (!canManageRef.current) return;
    const validation = validateCommentForm(commentForm);
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    await runAction("comment", "Saved day comment.", async () => {
      await apiClient.upsertHomeschoolDayComment({
        child_id: parseRequiredId(commentForm.childId),
        comment: commentForm.comment,
        date: commentForm.date,
        household_id: householdId,
      });
    });
  }

  function editComment(comment: HomeschoolDayComment) {
    if (!canManageRef.current) return;
    setSelectedChildId(comment.child_id);
    setSelectedDate(comment.date);
    setCalendarYearMonth(toYearMonth(comment.date));
    setCommentForm({
      childId: comment.child_id.toString(),
      comment: comment.comment,
      date: comment.date,
    });
    clearFeedback();
  }

  function confirmDeleteComment(comment: HomeschoolDayComment) {
    if (!canManageRef.current) return;
    Alert.alert("Delete day comment?", "This day comment will be removed.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          if (!canManageRef.current) return;
          void deleteComment(comment);
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteComment(comment: HomeschoolDayComment) {
    if (!canManageRef.current) return;
    await runAction("delete", "Deleted day comment.", async () => {
      await apiClient.deleteHomeschoolDayComment(comment.id, householdId);
    });
  }

  async function saveGrade() {
    if (!canManageRef.current) return;
    const validation = validateGradeForm(gradeForm);
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    await runAction("grade", "Saved grade.", async () => {
      await apiClient.upsertHomeschoolGrade({
        child_id: parseRequiredId(gradeForm.childId),
        grade: gradeForm.grade,
        household_id: householdId,
        semester_id: parseOptionalId(gradeForm.semesterId),
        subject_id: parseRequiredId(gradeForm.subjectId),
      });
    });
  }

  function editGrade(grade: HomeschoolGrade) {
    if (!canManageRef.current) return;
    setSelectedChildId(grade.child_id);
    setGradeForm({
      childId: grade.child_id.toString(),
      grade: grade.grade,
      semesterId: grade.semester_id?.toString() ?? "",
      subjectId: grade.subject_id.toString(),
    });
    clearFeedback();
  }

  function confirmDeleteGrade(grade: HomeschoolGrade) {
    if (!canManageRef.current) return;
    Alert.alert("Delete grade?", "This grade record will be removed.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          if (!canManageRef.current) return;
          void deleteGrade(grade);
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteGrade(grade: HomeschoolGrade) {
    if (!canManageRef.current) return;
    await runAction("delete", "Deleted grade.", async () => {
      await apiClient.deleteHomeschoolGrade(grade.id, householdId);
    });
  }

  function openAttendanceForSelectedDay() {
    if (!canManageRef.current) return;
    if (selectedChildId !== null) {
      setAttendanceForm((previous) => ({
        ...previous,
        childId: selectedChildId.toString(),
        date: selectedDate,
      }));
    }
  }

  function openCommentForSelectedDay() {
    if (!canManageRef.current) return;
    if (selectedChildId !== null) {
      const existingComment = selectedChildComments.find(
        (comment) => comment.date === selectedDate,
      );
      setCommentForm({
        childId: selectedChildId.toString(),
        comment: existingComment?.comment ?? "",
        date: selectedDate,
      });
    }
  }

  return {
    attendanceForm,
    commentForm,
    confirmDeleteAttendance,
    confirmDeleteComment,
    confirmDeleteGrade,
    editAttendance,
    editComment,
    editGrade,
    gradeForm,
    openAttendanceForSelectedDay,
    openCommentForSelectedDay,
    saveAttendance,
    saveComment,
    saveGrade,
    updateAttendanceForm,
    updateCommentForm,
    updateGradeForm,
  };
}
