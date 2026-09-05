import { useState } from "react";
import { Alert } from "react-native";

import { apiClient } from "../../../api/client";
import type {
  Child,
  Chore,
  CreateChoreRequest,
  EligibleChore,
  UpdateChoreRequest,
} from "../../../api/models";
import { todayDateString } from "../../../utils/date";
import { formatError } from "../../../utils/format";
import {
  buildCreateChoreRequest,
  buildDefaultChoreForm,
  buildEditChoreForm,
  buildUpdateChoreRequest,
  type MobileChoreFormState,
  showScheduleInterval,
} from "../lib/chorePresentation";
import type { EligibleChildState } from "./useChoreData";

type UseChoreMutationsOptions = {
  clearMyTasksError: () => void;
  clearSelectedChores: () => void;
  householdId: number;
  loadChildrenAndEligible: () => Promise<void>;
  loadChores: () => Promise<void>;
  loadMyTasks: () => Promise<void>;
  myTasksError: string | null;
  patchEligibleChildState: (
    childId: number,
    patch: Partial<EligibleChildState>,
  ) => void;
  refreshEligibleForChild: (
    childId: number,
    options?: { preserveMessage?: boolean },
  ) => Promise<void>;
  selectedChild: Child | null;
  selectedChoreIds: number[];
  setChoresError: (error: unknown) => void;
  setSelectedSubmitError: (error: string | null) => void;
  setSelectedSubmitSuccess: (message: string | null) => void;
  targetDate: string;
  userId: number;
};

type ChoreFormOperation =
  | { kind: "create"; payload: CreateChoreRequest }
  | { choreId: number; kind: "update"; payload: UpdateChoreRequest };

export function useChoreMutations({
  clearMyTasksError,
  clearSelectedChores,
  householdId,
  loadChildrenAndEligible,
  loadChores,
  loadMyTasks,
  myTasksError,
  patchEligibleChildState,
  refreshEligibleForChild,
  selectedChild,
  selectedChoreIds,
  setChoresError,
  setSelectedSubmitError,
  setSelectedSubmitSuccess,
  targetDate,
  userId,
}: UseChoreMutationsOptions) {
  const [form, setForm] = useState<MobileChoreFormState>(() =>
    buildDefaultChoreForm(todayDateString()),
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [selectedSubmitting, setSelectedSubmitting] = useState(false);

  const showInterval = showScheduleInterval(form);
  const submitError = formSubmitError ?? myTasksError;

  function clearSubmitError(): void {
    setFormSubmitError(null);
    clearMyTasksError();
  }

  function openCreateForm(): void {
    setEditingId(null);
    setForm(buildDefaultChoreForm(todayDateString()));
    clearSubmitError();
    setShowForm(true);
  }

  function openEditForm(chore: Chore): void {
    setEditingId(chore.id);
    setForm(buildEditChoreForm(chore));
    clearSubmitError();
    setShowForm(true);
  }

  function cancelForm(): void {
    setShowForm(false);
    setEditingId(null);
    clearSubmitError();
  }

  function setField<K extends keyof MobileChoreFormState>(
    key: K,
    value: MobileChoreFormState[K],
  ): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitChoreForm(): Promise<void> {
    let operation: ChoreFormOperation;
    try {
      operation =
        editingId === null
          ? {
              kind: "create",
              payload: buildCreateChoreRequest(form, householdId, userId),
            }
          : {
              choreId: editingId,
              kind: "update",
              payload: buildUpdateChoreRequest(form, householdId, userId),
            };
    } catch (error) {
      setFormSubmitError(formatError(error));
      return;
    }

    setSubmittingForm(true);
    clearSubmitError();
    try {
      if (operation.kind === "update") {
        await apiClient.updateChore(operation.choreId, operation.payload);
      } else {
        await apiClient.createChore(operation.payload);
      }

      setShowForm(false);
      setEditingId(null);
      await loadChores();
      await loadMyTasks();
      await loadChildrenAndEligible();
    } catch (error) {
      setFormSubmitError(formatError(error));
    } finally {
      setSubmittingForm(false);
    }
  }

  async function archiveChore(chore: Chore): Promise<void> {
    setArchivingId(chore.id);
    try {
      await apiClient.archiveChore(chore.id, householdId);
      await loadChores();
      await loadChildrenAndEligible();
    } catch (error) {
      setChoresError(error);
    } finally {
      setArchivingId(null);
    }
  }

  function confirmArchive(chore: Chore): void {
    Alert.alert(
      "Archive chore?",
      `"${chore.name}" will stop appearing for children but history stays intact.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          style: "destructive",
          text: "Archive",
          onPress: () => {
            void archiveChore(chore);
          },
        },
      ],
    );
  }

  async function quickSubmit(
    child: Child,
    chore: EligibleChore,
  ): Promise<void> {
    patchEligibleChildState(child.id, {
      submittingChoreId: chore.chore_id,
      error: null,
      message: null,
    });

    try {
      await apiClient.createSubmission(
        { for_date: targetDate, chore_ids: [chore.chore_id] },
        { child_id: child.id },
      );
      patchEligibleChildState(child.id, {
        message: `Submitted ${chore.name} for review.`,
        submittingChoreId: null,
      });
      await refreshEligibleForChild(child.id, { preserveMessage: true });
    } catch (error) {
      patchEligibleChildState(child.id, {
        error: formatError(error),
        submittingChoreId: null,
        message: null,
      });
    }
  }

  async function submitSelected(): Promise<void> {
    if (selectedChild === null) {
      setSelectedSubmitError("Select a child first.");
      return;
    }
    if (selectedChoreIds.length === 0) {
      setSelectedSubmitError("Select at least one chore to submit.");
      return;
    }

    setSelectedSubmitting(true);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
    try {
      await apiClient.createSubmission(
        { for_date: targetDate, chore_ids: selectedChoreIds },
        { child_id: selectedChild.id },
      );
      setSelectedSubmitSuccess(
        `Submitted ${selectedChoreIds.length} chore(s) for ${selectedChild.name}.`,
      );
      clearSelectedChores();
      await refreshEligibleForChild(selectedChild.id);
    } catch (error) {
      setSelectedSubmitError(formatError(error));
    } finally {
      setSelectedSubmitting(false);
    }
  }

  async function completeParentTask(choreId: number): Promise<void> {
    await apiClient.completeParentTask(choreId, targetDate);
    await loadMyTasks();
  }

  return {
    archivingId,
    cancelForm,
    completeParentTask,
    confirmArchive,
    editingId,
    form,
    openCreateForm,
    openEditForm,
    quickSubmit,
    selectedSubmitting,
    setField,
    setForm,
    showForm,
    showInterval,
    submitChoreForm,
    submitError,
    submitSelected,
    submittingForm,
  };
}
