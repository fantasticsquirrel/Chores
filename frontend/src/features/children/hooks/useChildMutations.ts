import { useState } from "react";

import { apiClient, type Child } from "../../../api";
import { formatApiError } from "../../../lib/errors";

type UseChildMutationsOptions = {
  householdId: number | null;
  loadChildren: () => Promise<void>;
};

export type UseChildMutationsResult = {
  activeOnCreate: boolean;
  createChild: () => Promise<void>;
  nameInput: string;
  setActiveOnCreate: (active: boolean) => void;
  setNameInput: (name: string) => void;
  submitError: string | null;
  submitting: boolean;
  toggleActive: (child: Child) => Promise<void>;
  updatingChildId: number | null;
};

export function useChildMutations({
  householdId,
  loadChildren,
}: UseChildMutationsOptions): UseChildMutationsResult {
  const [nameInput, setNameInput] = useState("");
  const [activeOnCreate, setActiveOnCreate] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingChildId, setUpdatingChildId] = useState<number | null>(null);

  async function createChild(): Promise<void> {
    const trimmedName = nameInput.trim();
    if (trimmedName.length === 0) {
      setSubmitError("Child name is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (householdId === null) {
        throw new Error("Could not determine household scope.");
      }

      await apiClient.createChild({
        household_id: householdId,
        name: trimmedName,
        active: activeOnCreate,
      });
      setNameInput("");
      setActiveOnCreate(true);
      await loadChildren();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(child: Child): Promise<void> {
    if (householdId === null) {
      setSubmitError("Could not determine household scope.");
      return;
    }

    setUpdatingChildId(child.id);
    setSubmitError(null);

    try {
      await apiClient.updateChild(child.id, {
        household_id: householdId,
        active: !child.active,
      });
      await loadChildren();
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
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
    submitting,
    toggleActive,
    updatingChildId,
  };
}
