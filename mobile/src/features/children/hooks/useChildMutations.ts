import { useState } from "react";

import { apiClient } from "../../../api/client";
import type { Child } from "../../../api/models";
import { formatError } from "../../../utils/format";

type UseChildMutationsOptions = {
  householdId: number;
  loadChildren: () => Promise<void>;
};

export type UseChildMutationsResult = {
  activeOnCreate: boolean;
  createChild: () => Promise<void>;
  nameInput: string;
  setActiveOnCreate: (active: boolean) => void;
  setNameInput: (name: string) => void;
  submitError: string | null;
  submitSuccess: string | null;
  submitting: boolean;
  toggleActive: (child: Child) => Promise<void>;
  updatingChildId: number | null;
};

export function useChildMutations({
  householdId,
  loadChildren,
}: UseChildMutationsOptions): UseChildMutationsResult {
  const [nameInput, setNameInputState] = useState("");
  const [activeOnCreate, setActiveOnCreate] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingChildId, setUpdatingChildId] = useState<number | null>(null);

  function setNameInput(name: string) {
    setNameInputState(name);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  async function createChild() {
    const trimmedName = nameInput.trim();
    if (trimmedName.length === 0) {
      setSubmitSuccess(null);
      setSubmitError("Child name is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await apiClient.createChild({
        household_id: householdId,
        name: trimmedName,
        active: activeOnCreate,
      });
      setNameInputState("");
      setActiveOnCreate(true);
      setSubmitSuccess("Child created.");
      await loadChildren();
    } catch (error) {
      setSubmitError(`Could not save child: ${formatError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(child: Child) {
    setUpdatingChildId(child.id);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await apiClient.updateChild(child.id, {
        household_id: householdId,
        active: !child.active,
      });
      setSubmitSuccess(
        `${child.name} is now ${child.active ? "inactive" : "active"}.`,
      );
      await loadChildren();
    } catch (error) {
      setSubmitError(`Could not save child: ${formatError(error)}`);
    } finally {
      setUpdatingChildId(null);
    }
  }

  return {
    activeOnCreate,
    createChild,
    nameInput,
    setActiveOnCreate,
    setNameInput,
    submitError,
    submitSuccess,
    submitting,
    toggleActive,
    updatingChildId,
  };
}
