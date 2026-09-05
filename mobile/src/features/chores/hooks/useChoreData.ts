import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../../../api/client";
import type { Child, Chore, EligibleChore } from "../../../api/models";
import { todayDateString } from "../../../utils/date";
import { formatError } from "../../../utils/format";

export type ChoresState = {
  chores: Chore[];
  loading: boolean;
  error: string | null;
};

export type ChildrenState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

export type EligibleChildState = {
  chores: EligibleChore[];
  loading: boolean;
  error: string | null;
  message: string | null;
  submittingChoreId: number | null;
};

export const EMPTY_ELIGIBLE_STATE: EligibleChildState = {
  chores: [],
  loading: false,
  error: null,
  message: null,
  submittingChoreId: null,
};

export function useChoreData({ householdId }: { householdId: number }) {
  const [targetDate, setTargetDate] = useState(todayDateString);
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [selectedChoreIds, setSelectedChoreIds] = useState<number[]>([]);
  const [selectedSubmitError, setSelectedSubmitError] = useState<string | null>(
    null,
  );
  const [selectedSubmitSuccess, setSelectedSubmitSuccess] = useState<
    string | null
  >(null);
  const [choresState, setChoresState] = useState<ChoresState>({
    chores: [],
    loading: true,
    error: null,
  });
  const [myTasks, setMyTasks] = useState<Chore[]>([]);
  const [myTasksError, setMyTasksError] = useState<string | null>(null);

  const activeChildren = useMemo(
    () => childrenState.children.filter((child) => child.active),
    [childrenState.children],
  );
  const selectedChild =
    selectedChildId === null
      ? null
      : (activeChildren.find((child) => child.id === selectedChildId) ?? null);
  const selectedEligibleState =
    selectedChild !== null
      ? (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE)
      : EMPTY_ELIGIBLE_STATE;

  const loadChores = useCallback(async (): Promise<void> => {
    setChoresState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const chores = await apiClient.listChores({
        household_id: householdId,
        active_only: false,
      });
      setChoresState({ chores, loading: false, error: null });
    } catch (error) {
      setChoresState({
        chores: [],
        loading: false,
        error: formatError(error),
      });
    }
  }, [householdId]);

  const loadMyTasks = useCallback(async (): Promise<void> => {
    try {
      setMyTasks(await apiClient.listMyParentTasks(targetDate));
    } catch (error) {
      setMyTasksError(formatError(error));
    }
  }, [targetDate]);

  const patchEligibleChildState = useCallback(
    (childId: number, patch: Partial<EligibleChildState>): void => {
      setEligibleByChildId((previous) => ({
        ...previous,
        [childId]: {
          ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
          ...patch,
        },
      }));
    },
    [],
  );

  const refreshEligibleForChild = useCallback(
    async (
      childId: number,
      options: { preserveMessage?: boolean } = {},
    ): Promise<void> => {
      setEligibleByChildId((previous) => ({
        ...previous,
        [childId]: {
          ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
          loading: true,
          error: null,
          message: options.preserveMessage
            ? (previous[childId]?.message ?? null)
            : null,
        },
      }));

      try {
        const chores = await apiClient.listEligibleChores({
          date: targetDate,
          child_id: childId,
        });
        setEligibleByChildId((previous) => ({
          ...previous,
          [childId]: {
            ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
            chores,
            loading: false,
            error: null,
            message: options.preserveMessage
              ? (previous[childId]?.message ?? null)
              : null,
            submittingChoreId: null,
          },
        }));
        setSelectedChoreIds((previous) =>
          previous.filter((choreId) =>
            chores.some((chore) => chore.chore_id === choreId),
          ),
        );
      } catch (error) {
        setEligibleByChildId((previous) => ({
          ...previous,
          [childId]: {
            ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
            chores: [],
            loading: false,
            error: formatError(error),
            message: null,
            submittingChoreId: null,
          },
        }));
        setSelectedChoreIds([]);
      }
    },
    [targetDate],
  );

  const loadChildrenAndEligible = useCallback(async (): Promise<void> => {
    setChildrenState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
    setSelectedChoreIds([]);

    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      const active = children.filter((child) => child.active);
      setChildrenState({ children, loading: false, error: null });
      setSelectedChildId((previous) =>
        previous !== null && active.some((child) => child.id === previous)
          ? previous
          : (active[0]?.id ?? null),
      );

      setEligibleByChildId(
        Object.fromEntries(
          active.map((child) => [
            child.id,
            { ...EMPTY_ELIGIBLE_STATE, loading: true },
          ]),
        ),
      );
      const results = await Promise.all(
        active.map(async (child) => {
          try {
            const chores = await apiClient.listEligibleChores({
              date: targetDate,
              child_id: child.id,
            });
            return [child.id, { ...EMPTY_ELIGIBLE_STATE, chores }] as const;
          } catch (error) {
            return [
              child.id,
              { ...EMPTY_ELIGIBLE_STATE, error: formatError(error) },
            ] as const;
          }
        }),
      );
      setEligibleByChildId(Object.fromEntries(results));
    } catch (error) {
      setChildrenState({
        children: [],
        loading: false,
        error: formatError(error),
      });
      setEligibleByChildId({});
    }
  }, [householdId, targetDate]);

  useEffect(() => {
    void loadChores();
  }, [loadChores]);

  useEffect(() => {
    void loadMyTasks();
  }, [loadMyTasks]);

  useEffect(() => {
    void loadChildrenAndEligible();
  }, [loadChildrenAndEligible]);

  function changeTargetDate(nextDate: string): void {
    setTargetDate(nextDate);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function selectChild(childId: number): void {
    setSelectedChildId(childId);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function toggleSelectedChore(choreId: number): void {
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }

  const getEligibleState = useCallback(
    (childId: number): EligibleChildState =>
      eligibleByChildId[childId] ?? EMPTY_ELIGIBLE_STATE,
    [eligibleByChildId],
  );

  function setChoresError(error: unknown): void {
    setChoresState((previous) => ({
      ...previous,
      error: formatError(error),
    }));
  }

  return {
    activeChildren,
    changeTargetDate,
    childrenState,
    choresState,
    clearMyTasksError: () => setMyTasksError(null),
    clearSelectedChores: () => setSelectedChoreIds([]),
    getEligibleState,
    loadChildrenAndEligible,
    loadChores,
    loadMyTasks,
    myTasks,
    myTasksError,
    patchEligibleChildState,
    refreshEligibleForChild,
    selectChild,
    selectedChild,
    selectedChildId,
    selectedChoreIds,
    selectedEligibleState,
    selectedSubmitError,
    selectedSubmitSuccess,
    setChoresError,
    setSelectedSubmitError,
    setSelectedSubmitSuccess,
    targetDate,
    toggleSelectedChore,
  };
}
