import { useState } from "react";

import { formatError } from "../../../utils/format";

type BusyKey =
  | "attendance"
  | "comment"
  | "delete"
  | "grade"
  | "semester"
  | "subject";

export type RunHomeschoolAction = (
  key: BusyKey,
  successMessage: string,
  operation: () => Promise<void>,
  afterSuccess?: () => void,
) => Promise<void>;

export function useHomeschoolActionState(refresh: () => Promise<void>) {
  const [busyKey, setBusyKey] = useState<BusyKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function clearFeedback() {
    setActionError(null);
    setActionMessage(null);
  }

  const runAction: RunHomeschoolAction = async (
    key,
    successMessage,
    operation,
    afterSuccess,
  ) => {
    setBusyKey(key);
    clearFeedback();
    try {
      await operation();
      afterSuccess?.();
      setActionMessage(successMessage);
      await refresh();
    } catch (error) {
      setActionError(`Homeschool action failed: ${formatError(error)}`);
    } finally {
      setBusyKey(null);
    }
  };

  return {
    actionError,
    actionMessage,
    busy: busyKey !== null,
    clearFeedback,
    runAction,
    setActionError,
    setActionMessage,
  };
}
