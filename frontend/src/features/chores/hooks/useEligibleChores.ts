import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClient, type Child, type EligibleChore } from "../../../api";
import { formatApiError } from "../../../lib/errors";

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

const EMPTY_ELIGIBLE_STATE: EligibleChildState = {
  chores: [],
  loading: false,
  error: null,
  message: null,
  submittingChoreId: null,
};

function buildTodayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

type UseEligibleChoresResult = {
  canSubmitChores: (
    childId: number,
    choreIds: number[],
    date: string,
  ) => boolean;
  activeChildren: Child[];
  changeSelectedChild: (childId: string) => void;
  changeTargetDate: (date: string) => void;
  childrenState: ChildrenState;
  clearSelectedChores: () => void;
  getEligibleState: (childId: number) => EligibleChildState;
  loadChildrenAndEligible: () => Promise<void>;
  patchEligibleChildState: (
    childId: number,
    patch: Partial<EligibleChildState>,
  ) => void;
  refreshEligibleForChild: (
    childId: number,
    options?: { preserveMessage?: boolean },
  ) => Promise<void>;
  selectedChild: Child | null;
  selectedChildId: string;
  selectedChoreIds: number[];
  selectedEligibleState: EligibleChildState;
  selectToday: () => void;
  targetDate: string;
  toggleSelectedChore: (choreId: number) => void;
};

export function useEligibleChores(
  householdId: number | null,
  initial: { childId?: string; date?: string } = {},
): UseEligibleChoresResult {
  const [targetDate, setTargetDate] = useState(
    () => initial.date || buildTodayIsoDate(),
  );
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState(initial.childId ?? "");
  const [selectedChoreIds, setSelectedChoreIds] = useState<number[]>([]);

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
    if (initial.childId) {
      setSelectedChildId(initial.childId);
      setSelectedChoreIds([]);
    }
  }, [initial.childId]);
  useEffect(() => {
    if (initial.date) {
      if (initial.date !== scope.current.targetDate)
        submissionState.current.boardLoading = true;
      setTargetDate(initial.date);
      setSelectedChoreIds([]);
    }
  }, [initial.date]);

  const activeChildren = useMemo(
    () => childrenState.children.filter((child) => child.active),
    [childrenState.children],
  );
  const selectedChild =
    activeChildren.find((child) => child.id.toString() === selectedChildId) ??
    null;
  const rawSelectedEligibleState =
    selectedChild === null
      ? EMPTY_ELIGIBLE_STATE
      : (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE);
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
        if (selectedId.current === String(childId))
          setSelectedChoreIds((previous) =>
            previous.filter((choreId) =>
              chores.some((chore) => chore.chore_id === choreId),
            ),
          );
      } catch (error: unknown) {
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
            error: formatApiError(error),
            message: null,
            submittingChoreId: null,
          },
        }));
        if (selectedId.current === String(childId)) setSelectedChoreIds([]);
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
    if (householdId === null) {
      setChildrenState({
        children: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      setEligibleByChildId({});
      return;
    }

    setChildrenState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));
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
        previous.length > 0 &&
        active.some((child) => child.id.toString() === previous)
          ? previous
          : (active[0]?.id.toString() ?? ""),
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
          } catch (error: unknown) {
            return [
              child.id,
              { ...EMPTY_ELIGIBLE_STATE, error: formatApiError(error) },
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
    } catch (error: unknown) {
      if (
        request !== generation.current ||
        scope.current.targetDate !== targetDate
      )
        return;
      setChildrenState({
        children: [],
        loading: false,
        error: formatApiError(error),
      });
      setEligibleByChildId({});
    }
  }, [householdId, targetDate]);

  useEffect(() => {
    void loadChildrenAndEligible();
  }, [loadChildrenAndEligible]);

  const changeTargetDate = useCallback((date: string): void => {
    if (date !== scope.current.targetDate)
      submissionState.current.boardLoading = true;
    setTargetDate(date);
    setSelectedChoreIds([]);
  }, []);

  const changeSelectedChild = useCallback((childId: string): void => {
    if (submissionState.current.boardLoading) return;
    setSelectedChildId(childId);
    setSelectedChoreIds([]);
  }, []);

  const selectToday = useCallback((): void => {
    changeTargetDate(buildTodayIsoDate());
  }, [changeTargetDate]);

  const clearSelectedChores = useCallback((): void => {
    setSelectedChoreIds([]);
  }, []);

  const toggleSelectedChore = useCallback(
    (choreId: number): void => {
      if (
        !canSubmitChores(
          Number(selectedId.current),
          [choreId],
          scope.current.targetDate,
        )
      )
        return;
      setSelectedChoreIds((previous) =>
        previous.includes(choreId)
          ? previous.filter((id) => id !== choreId)
          : [...previous, choreId],
      );
    },
    [canSubmitChores],
  );

  const getEligibleState = useCallback(
    (childId: number): EligibleChildState =>
      boardLoading
        ? { ...EMPTY_ELIGIBLE_STATE, loading: true }
        : (eligibleByChildId[childId] ?? EMPTY_ELIGIBLE_STATE),
    [boardLoading, eligibleByChildId],
  );

  return {
    canSubmitChores,
    activeChildren,
    changeSelectedChild,
    changeTargetDate,
    childrenState,
    clearSelectedChores,
    getEligibleState,
    loadChildrenAndEligible,
    patchEligibleChildState,
    refreshEligibleForChild,
    selectedChild,
    selectedChildId,
    selectedChoreIds,
    selectedEligibleState,
    selectToday,
    targetDate,
    toggleSelectedChore,
  };
}
