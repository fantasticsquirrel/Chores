import { useState } from "react";
import { Alert } from "react-native";

import { apiClient } from "../../../api/client";
import type {
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { todayDateString } from "../../../utils/date";
import {
  buildDefaultSemesterForm,
  buildDefaultSubjectForm,
  type SemesterFormState,
  type SubjectFormState,
} from "../lib/defaults";
import { normalizeSubjectColor } from "../lib/options";
import { validateSemesterForm, validateSubjectForm } from "../lib/validation";
import type { RunHomeschoolAction } from "./useHomeschoolActionState";

export function useHomeschoolSetupMutations({
  clearFeedback,
  householdId,
  runAction,
  setActionError,
  setActionMessage,
}: {
  clearFeedback: () => void;
  householdId: number;
  runAction: RunHomeschoolAction;
  setActionError: (message: string | null) => void;
  setActionMessage: (message: string | null) => void;
}) {
  const [semesterForm, setSemesterForm] = useState<SemesterFormState>(() =>
    buildDefaultSemesterForm(todayDateString()),
  );
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(
    buildDefaultSubjectForm,
  );
  const [editingSemesterId, setEditingSemesterId] = useState<number | null>(
    null,
  );
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

  function updateSemesterForm(patch: Partial<SemesterFormState>) {
    setSemesterForm((previous) => ({ ...previous, ...patch }));
    clearFeedback();
  }

  function updateSubjectForm(patch: Partial<SubjectFormState>) {
    setSubjectForm((previous) => ({ ...previous, ...patch }));
    clearFeedback();
  }

  function clearSemesterEdit() {
    setEditingSemesterId(null);
    setSemesterForm(buildDefaultSemesterForm(todayDateString()));
  }

  function clearSubjectEdit() {
    setEditingSubjectId(null);
    setSubjectForm(buildDefaultSubjectForm());
  }

  function editSemester(semester: HomeschoolSemester) {
    setEditingSemesterId(semester.id);
    setSemesterForm({
      active: semester.active,
      end_date: semester.end_date,
      name: semester.name,
      start_date: semester.start_date,
    });
    clearFeedback();
  }

  function editSubject(subject: HomeschoolSubject) {
    setEditingSubjectId(subject.id);
    setSubjectForm({
      active: subject.active,
      color: subject.color,
      name: subject.name,
    });
    clearFeedback();
  }

  async function saveSemester() {
    const validation = validateSemesterForm({
      endDate: semesterForm.end_date,
      name: semesterForm.name,
      startDate: semesterForm.start_date,
    });
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    const editingId = editingSemesterId;
    const trimmedName = semesterForm.name.trim();
    await runAction(
      "semester",
      editingId === null
        ? `Created semester ${trimmedName}.`
        : `Updated semester ${trimmedName}.`,
      async () => {
        const payload = {
          active: semesterForm.active,
          end_date: semesterForm.end_date,
          household_id: householdId,
          name: trimmedName,
          start_date: semesterForm.start_date,
        };
        if (editingId === null) {
          await apiClient.createHomeschoolSemester(payload);
        } else {
          await apiClient.updateHomeschoolSemester(editingId, payload);
        }
      },
      clearSemesterEdit,
    );
  }

  async function saveSubject() {
    const validation = validateSubjectForm(subjectForm);
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    const editingId = editingSubjectId;
    const trimmedName = subjectForm.name.trim();
    const color = normalizeSubjectColor(subjectForm.color);
    await runAction(
      "subject",
      editingId === null
        ? `Created subject ${trimmedName}.`
        : `Updated subject ${trimmedName}.`,
      async () => {
        const payload = {
          active: subjectForm.active,
          color,
          household_id: householdId,
          name: trimmedName,
        };
        if (editingId === null) {
          await apiClient.createHomeschoolSubject(payload);
        } else {
          await apiClient.updateHomeschoolSubject(editingId, payload);
        }
      },
      clearSubjectEdit,
    );
  }

  function confirmDeleteSemester(semester: HomeschoolSemester) {
    Alert.alert(
      "Delete semester?",
      `"${semester.name}" will be removed only if no grades depend on it.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void deleteSemester(semester);
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  async function deleteSemester(semester: HomeschoolSemester) {
    await runAction(
      "delete",
      "Deleted semester.",
      async () => {
        await apiClient.deleteHomeschoolSemester(semester.id, householdId);
      },
      () => {
        if (editingSemesterId === semester.id) {
          clearSemesterEdit();
        }
      },
    );
  }

  function confirmDeleteSubject(subject: HomeschoolSubject) {
    Alert.alert(
      "Delete subject?",
      `"${subject.name}" will be removed only if no attendance or grades depend on it.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void deleteSubject(subject);
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  async function deleteSubject(subject: HomeschoolSubject) {
    await runAction(
      "delete",
      "Deleted subject.",
      async () => {
        await apiClient.deleteHomeschoolSubject(subject.id, householdId);
      },
      () => {
        if (editingSubjectId === subject.id) {
          clearSubjectEdit();
        }
      },
    );
  }

  return {
    clearSemesterEdit,
    clearSubjectEdit,
    confirmDeleteSemester,
    confirmDeleteSubject,
    editSemester,
    editSubject,
    editingSemesterId,
    editingSubjectId,
    saveSemester,
    saveSubject,
    semesterForm,
    subjectForm,
    updateSemesterForm,
    updateSubjectForm,
  };
}
