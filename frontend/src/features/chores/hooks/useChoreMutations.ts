import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

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
  canSubmitChores: (
    childId: number,
    choreIds: number[],
    date: string,
  ) => boolean;
  onFormSaved?: () => void;
  canManage?: boolean;
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
  canSubmitChores,
  onFormSaved,
  canManage = true,
  clearSelectedChores,
  householdId,
  loadChildrenAndEligible,
  loadChores,
  loadMyTasks,
  patchEligibleChildState,
  selectedChild,
  selectedChoreIds,
  setChoresError,
  targetDate,
  userId,
}: UseChoreMutationsOptions) {
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  useEffect(() => {
    canManageRef.current = canManage;
    return () => {
      canManageRef.current = false;
    };
  }, [canManage]);
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

  const canSubmitChoresRef = useRef(canSubmitChores);
  canSubmitChoresRef.current = canSubmitChores;
  const currentContext = useRef({
    householdId,
    targetDate,
    childId: selectedChild?.id,
  });
  currentContext.current = {
    householdId,
    targetDate,
    childId: selectedChild?.id,
  };
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const savedCallback = useRef(onFormSaved);
  savedCallback.current = onFormSaved;
  const formBusy = useRef(false);
  const submitBusy = useRef(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const showInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";

  function clearSelectedSubmitFeedback(): void {
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function openCreateForm(): void {
    if (!canManageRef.current || formBusy.current) return;
    setEditingId(null);
    setForm(buildDefaultChoreForm());
    setSubmitError(null);
    setShowForm(true);
  }

  function openEditForm(chore: Chore): void {
    if (!canManageRef.current || formBusy.current) return;
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
  }
  function resumeForm(): void {
    setShowForm(true);
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
    if (!canManageRef.current || householdId === null || formBusy.current)
      return;

    let command:
      | { kind: "create"; payload: ReturnType<typeof buildCreateChorePayload> }
      | {
          kind: "update";
          choreId: number;
          payload: ReturnType<typeof buildUpdateChorePayload>;
        };
    try {
      command =
        editingId === null
          ? {
              kind: "create",
              payload: buildCreateChorePayload(form, householdId, userId),
            }
          : {
              kind: "update",
              choreId: editingId,
              payload: buildUpdateChorePayload(form, householdId, userId),
            };
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
      return;
    }

    formBusy.current = true;
    setSubmittingForm(true);
    setSubmitError(null);

    try {
      if (command.kind === "update") {
        await apiClient.updateChore(command.choreId, command.payload);
      } else {
        await apiClient.createChore(command.payload);
      }

      savedCallback.current?.();
      setSaveSuccess(
        command.kind === "create" ? "Chore created." : "Chore updated.",
      );
      setShowForm(false);
      setEditingId(null);
      clearSelectedSubmitFeedback();
      await loadChores();
      await loadMyTasks();
      await loadChildrenAndEligible();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      formBusy.current = false;
      setSubmittingForm(false);
    }
  }

  async function handleArchive(chore: Chore): Promise<void> {
    if (!canManageRef.current) return;
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
      !canManageRef.current ||
      submitBusy.current ||
      !canSubmitChoresRef.current(child.id, [chore.chore_id], targetDate)
    )
      return;
    if (
      !window.confirm(
        `Submit "${chore.name}" for ${child.name} on ${targetDate}?`,
      )
    )
      return;

    submitBusy.current = true;
    setQuickSubmitting(true);
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
      if (
        currentContext.current.householdId !== householdId ||
        currentContext.current.targetDate !== targetDate
      )
        return;
      patchEligibleChildState(child.id, {
        message: `Submitted ${chore.name} for review.`,
        submittingChoreId: null,
      });
      await loadChildrenAndEligible();
      if (
        currentContext.current.householdId !== householdId ||
        currentContext.current.targetDate !== targetDate
      )
        return;
      patchEligibleChildState(child.id, {
        message: `Submitted ${chore.name} for review.`,
      });
    } catch (error: unknown) {
      if (
        currentContext.current.householdId !== householdId ||
        currentContext.current.targetDate !== targetDate
      )
        return;
      patchEligibleChildState(child.id, {
        error: formatApiError(error),
        submittingChoreId: null,
        message: null,
      });
    } finally {
      submitBusy.current = false;
      setQuickSubmitting(false);
    }
  }

  async function handleSelectedSubmit(): Promise<void> {
    if (!canManageRef.current || submitBusy.current) return;
    if (selectedChild === null) {
      setSelectedSubmitError("Select a child first.");
      return;
    }
    if (selectedChoreIds.length === 0) {
      setSelectedSubmitError("Select at least one chore to submit.");
      return;
    }

    if (
      !canSubmitChoresRef.current(
        selectedChild.id,
        selectedChoreIds,
        targetDate,
      )
    )
      return;
    submitBusy.current = true;
    setSelectedSubmitting(true);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);

    try {
      await apiClient.createSubmission(
        { for_date: targetDate, chore_ids: selectedChoreIds },
        { child_id: selectedChild.id },
      );
      if (
        currentContext.current.householdId !== householdId ||
        currentContext.current.targetDate !== targetDate ||
        currentContext.current.childId !== selectedChild.id
      )
        return;
      setSelectedSubmitSuccess(
        `Submitted ${selectedChoreIds.length} chore(s) for ${selectedChild.name}.`,
      );
      clearSelectedChores();
      await loadChildrenAndEligible();
    } catch (error: unknown) {
      if (
        currentContext.current.householdId !== householdId ||
        currentContext.current.targetDate !== targetDate ||
        currentContext.current.childId !== selectedChild.id
      )
        return;
      setSelectedSubmitError(formatApiError(error));
    } finally {
      submitBusy.current = false;
      setSelectedSubmitting(false);
    }
  }

  async function completeParentTask(choreId: number): Promise<void> {
    if (!canManageRef.current) return;
    await apiClient.completeParentTask(choreId, targetDate);
    await loadMyTasks();
  }

  return {
    archivingId,
    cancelForm,
    resumeForm,
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
    saveSuccess,
    selectedSubmitError,
    selectedSubmitSuccess,
    quickSubmitting,
    selectedSubmitting,
    setField,
    showForm,
    showInterval,
    submitError,
    submittingForm,
  };
}
