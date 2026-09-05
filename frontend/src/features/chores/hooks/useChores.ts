import { useCallback, useEffect, useState } from "react";

import { apiClient, type Chore } from "../../../api";
import { formatApiError } from "../../../lib/errors";

type ChoresState = {
  chores: Chore[];
  loading: boolean;
  error: string | null;
};

type UseChoresOptions = {
  householdId: number | null;
  targetDate: string;
  userId: number | null;
};

type UseChoresResult = {
  choresState: ChoresState;
  loadChores: () => Promise<void>;
  loadMyTasks: () => Promise<void>;
  myTasks: Chore[];
  setChoresError: (error: unknown) => void;
};

export function useChores({
  householdId,
  targetDate,
  userId,
}: UseChoresOptions): UseChoresResult {
  const [choresState, setChoresState] = useState<ChoresState>({
    chores: [],
    loading: true,
    error: null,
  });
  const [myTasks, setMyTasks] = useState<Chore[]>([]);

  const loadChores = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setChoresState({
        chores: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      return;
    }

    setChoresState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const chores = await apiClient.listChores({
        household_id: householdId,
        active_only: false,
      });
      setChoresState({ chores, loading: false, error: null });
    } catch (error: unknown) {
      setChoresState({
        chores: [],
        loading: false,
        error: formatApiError(error),
      });
    }
  }, [householdId]);

  const loadMyTasks = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    setMyTasks(await apiClient.listMyParentTasks(targetDate));
  }, [targetDate, userId]);

  const setChoresError = useCallback((error: unknown): void => {
    setChoresState((previous) => ({
      ...previous,
      error: formatApiError(error),
    }));
  }, []);

  useEffect(() => {
    void loadChores();
  }, [loadChores]);

  useEffect(() => {
    void loadMyTasks();
  }, [loadMyTasks]);

  return {
    choresState,
    loadChores,
    loadMyTasks,
    myTasks,
    setChoresError,
  };
}
