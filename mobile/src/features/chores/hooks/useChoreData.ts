import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export function useChoreData({
  householdId,
  initialChildId,
  initialDate,
}: {
  householdId: number;
  initialChildId?: number;
  initialDate?: string;
}) {
  const [targetDate, setTargetDate] = useState(
    () => initialDate ?? todayDateString(),
  );
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState<number | null>(
    initialChildId ?? null,
  );
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

  // Eligibility belongs to one household/date, never to whichever date is currently displayed.
  const eligibilityScope = `${householdId}:${targetDate}`;
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const boardLoading =
    childrenState.loading || loadedScope !== eligibilityScope;

  const scope = useRef({ householdId, targetDate });
  scope.current = { householdId, targetDate };
  const selectedId = useRef(selectedChildId);
  selectedId.current = selectedChildId;
  const generation = useRef(0);
  const eligibleRequests = useRef<Record<number, number>>({});
  useEffect(() => {
    if (initialChildId !== undefined) setSelectedChildId(initialChildId);
    if (initialDate) {
      if (initialDate !== scope.current.targetDate)
        submissionState.current.boardLoading = true;
      setTargetDate(initialDate);
    }
    setSelectedChoreIds([]);
  }, [initialChildId, initialDate]);

  const activeChildren = useMemo(
    () => childrenState.children.filter((child) => child.active),
    [childrenState.children],
  );
  const selectedChild =
    selectedChildId === null
      ? null
      : (activeChildren.find((child) => child.id === selectedChildId) ?? null);
  const rawSelectedEligibleState =
    selectedChild !== null
      ? (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE)
      : EMPTY_ELIGIBLE_STATE;
  const selectedEligibleState = boardLoading
    ? { ...EMPTY_ELIGIBLE_STATE, loading: true }
    : rawSelectedEligibleState;
  const submissionState = useRef({ boardLoading, eligibleByChildId });
  submissionState.current = { boardLoading, eligibleByChildId };
  const canSubmitChores = useCallback(
    (childId: number, choreIds: number[], date: string): boolean => {
      const current = submissionState.current;
      const eligible = current.eligibleByChildId[childId];
      return (
        !current.boardLoading &&
        scope.current.targetDate === date &&
        !!eligible &&
        !eligible.loading &&
        eligible.error === null &&
        choreIds.length > 0 &&
        choreIds.every((id) =>
          eligible.chores.some((chore) => chore.chore_id === id),
        )
      );
    },
    [],
  );

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
      if (
        scope.current.householdId !== householdId ||
        scope.current.targetDate !== targetDate
      )
        return;
      submissionState.current.eligibleByChildId = {
        ...submissionState.current.eligibleByChildId,
        [childId]: {
          ...(submissionState.current.eligibleByChildId[childId] ??
            EMPTY_ELIGIBLE_STATE),
          loading: true,
        },
      };
      const ticket = (eligibleRequests.current[childId] ?? 0) + 1;
      eligibleRequests.current[childId] = ticket;
      const loadGeneration = generation.current;
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
        if (
          scope.current.targetDate !== targetDate ||
          scope.current.householdId !== householdId ||
          ticket !== eligibleRequests.current[childId] ||
          loadGeneration !== generation.current
        )
          return;
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
        if (selectedId.current === childId)
          setSelectedChoreIds((previous) =>
            previous.filter((choreId) =>
              chores.some((chore) => chore.chore_id === choreId),
            ),
          );
      } catch (error) {
        if (
          scope.current.targetDate !== targetDate ||
          scope.current.householdId !== householdId ||
          ticket !== eligibleRequests.current[childId] ||
          loadGeneration !== generation.current
        )
          return;
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
        if (selectedId.current === childId) setSelectedChoreIds([]);
      }
    },
    [householdId, targetDate],
  );

  const loadChildrenAndEligible = useCallback(async (): Promise<void> => {
    if (
      scope.current.householdId !== householdId ||
      scope.current.targetDate !== targetDate
    )
      return;
    const request = ++generation.current;
    submissionState.current.boardLoading = true;
    setLoadedScope(null);
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
      if (
        request !== generation.current ||
        scope.current.householdId !== householdId ||
        scope.current.targetDate !== targetDate
      )
        return;
      const active = children.filter((child) => child.active);
      setChildrenState({ children, loading: false, error: null });
      setLoadedScope(`${householdId}:${targetDate}`);
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
      const tickets = new Map(
        active.map((child) => {
          const ticket = (eligibleRequests.current[child.id] ?? 0) + 1;
          eligibleRequests.current[child.id] = ticket;
          return [child.id, ticket] as const;
        }),
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
      if (
        request === generation.current &&
        scope.current.targetDate === targetDate
      )
        setEligibleByChildId((previous) => ({
          ...previous,
          ...Object.fromEntries(
            results.filter(
              ([childId]) =>
                eligibleRequests.current[childId] === tickets.get(childId),
            ),
          ),
        }));
    } catch (error) {
      if (
        request !== generation.current ||
        scope.current.targetDate !== targetDate
      )
        return;
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
    if (nextDate !== scope.current.targetDate)
      submissionState.current.boardLoading = true;
    setTargetDate(nextDate);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function selectChild(childId: number): void {
    if (submissionState.current.boardLoading) return;
    setSelectedChildId(childId);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function toggleSelectedChore(choreId: number): void {
    if (
      selectedId.current === null ||
      !canSubmitChores(selectedId.current, [choreId], scope.current.targetDate)
    )
      return;
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }

  const getEligibleState = useCallback(
    (childId: number): EligibleChildState =>
      boardLoading
        ? { ...EMPTY_ELIGIBLE_STATE, loading: true }
        : (eligibleByChildId[childId] ?? EMPTY_ELIGIBLE_STATE),
    [boardLoading, eligibleByChildId],
  );

  function setChoresError(error: unknown): void {
    setChoresState((previous) => ({
      ...previous,
      error: formatError(error),
    }));
  }

  return {
    canSubmitChores,
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
