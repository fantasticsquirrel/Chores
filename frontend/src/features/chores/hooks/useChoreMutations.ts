import type { FormEvent } from "react";
import { useState } from "react";

import {
  apiClient,
  type Child,
  type Chore,
  type EligibleChore,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import {
  buildCreateChorePayload,
  buildDefaultChoreForm,
  buildUpdateChorePayload,
  type ChoreFormState,
} from "../lib/choreForm";
import type { EligibleChildState } from "./useEligibleChores";

type UseChoreMutationsOptions = {
  clearSelectedChores: () => void;
  householdId: number | null;
  loadChildrenAndEligible: () => Promise<void>;
  loadChores: () => Promise<void>;
  loadMyTasks: () => Promise<void>;
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
  targetDate: string;
  userId: number | null;
};

export function useChoreMutations({
  clearSelectedChores,
  householdId,
  loadChildrenAndEligible,
  loadChores,
  loadMyTasks,
  patchEligibleChildState,
  refreshEligibleForChild,
  selectedChild,
  selectedChoreIds,
  setChoresError,
  targetDate,
  userId,
}: UseChoreMutationsOptions) {
  const [form, setForm] = useState<ChoreFormState>(buildDefaultChoreForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [selectedSubmitError, setSelectedSubmitError] = useState<string | null>(
    null,
  );
  const [selectedSubmitSuccess, setSelectedSubmitSuccess] = useState<
    string | null
  >(null);
  const [selectedSubmitting, setSelectedSubmitting] = useState(false);

  const showInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";

  function clearSelectedSubmitFeedback(): void {
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function openCreateForm(): void {
    setEditingId(null);
    setForm(buildDefaultChoreForm());
    setSubmitError(null);
    setShowForm(true);
  }

  function openEditForm(chore: Chore): void {
    setEditingId(chore.id);
    setForm({
      name: chore.name,
      task_scope: chore.owner_user_id === null ? "CHILD" : "PARENT",
      reward_dollars: (chore.reward_cents / 100).toFixed(2),
      start_date: chore.start_date,
      expires_at: chore.expires_at ?? "",
      timeout_days: chore.timeout_days?.toString() ?? "",
      schedule_mode: chore.schedule_mode,
      schedule_interval: String(chore.schedule_interval ?? 1),
      schedule_unit: chore.schedule_unit ?? "WEEK",
      completion_mode: chore.completion_mode,
      assignment_mode: chore.assignment_mode,
      allowed_child_ids: chore.allowed_child_ids,
      rotation_order: chore.rotation_order,
    });
    setSubmitError(null);
    setShowForm(true);
  }

  function cancelForm(): void {
    setShowForm(false);
    setEditingId(null);
    setSubmitError(null);
  }

  function setField<K extends keyof ChoreFormState>(
    key: K,
    value: ChoreFormState[K],
  ): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;

    let payload;
    try {
      payload =
        editingId === null
          ? buildCreateChorePayload(form, householdId, userId)
          : buildUpdateChorePayload(form, householdId, userId);
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
      return;
    }

    setSubmittingForm(true);
    setSubmitError(null);

    try {
      if (editingId !== null) {
        await apiClient.updateChore(editingId, payload);
      } else {
        await apiClient.createChore(payload);
      }

      setShowForm(false);
      setEditingId(null);
      clearSelectedSubmitFeedback();
      await loadChores();
      await loadMyTasks();
      await loadChildrenAndEligible();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmittingForm(false);
    }
  }

  async function handleArchive(chore: Chore): Promise<void> {
    if (householdId === null) return;
    if (
      !window.confirm(
        `Archive "${chore.name}"? It will stop appearing for children but history stays intact.`,
      )
    )
      return;

    setArchivingId(chore.id);
    try {
      await apiClient.archiveChore(chore.id, householdId);
      await loadChores();
      clearSelectedSubmitFeedback();
      await loadChildrenAndEligible();
    } catch (error: unknown) {
      setChoresError(error);
    } finally {
      setArchivingId(null);
    }
  }

  async function handleQuickSubmit(
    child: Child,
    chore: EligibleChore,
  ): Promise<void> {
    if (
      !window.confirm(
        `Submit "${chore.name}" for ${child.name} on ${targetDate}?`,
      )
    )
      return;

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
    } catch (error: unknown) {
      patchEligibleChildState(child.id, {
        error: formatApiError(error),
        submittingChoreId: null,
        message: null,
      });
    }
  }

  async function handleSelectedSubmit(): Promise<void> {
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
    } catch (error: unknown) {
      setSelectedSubmitError(formatApiError(error));
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
    clearSelectedSubmitFeedback,
    completeParentTask,
    editingId,
    form,
    handleArchive,
    handleQuickSubmit,
    handleSelectedSubmit,
    handleSubmit,
    openCreateForm,
    openEditForm,
    selectedSubmitError,
    selectedSubmitSuccess,
    selectedSubmitting,
    setField,
    showForm,
    showInterval,
    submitError,
    submittingForm,
  };
}
