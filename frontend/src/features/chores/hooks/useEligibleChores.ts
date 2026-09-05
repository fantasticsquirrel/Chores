import { useCallback, useEffect, useMemo, useState } from "react";

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
  return new Date().toISOString().slice(0, 10);
}

type UseEligibleChoresResult = {
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
): UseEligibleChoresResult {
  const [targetDate, setTargetDate] = useState(buildTodayIsoDate);
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedChoreIds, setSelectedChoreIds] = useState<number[]>([]);

  const activeChildren = useMemo(
    () => childrenState.children.filter((child) => child.active),
    [childrenState.children],
  );
  const selectedChild =
    activeChildren.find((child) => child.id.toString() === selectedChildId) ??
    null;
  const selectedEligibleState =
    selectedChild === null
      ? EMPTY_ELIGIBLE_STATE
      : (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE);

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
      } catch (error: unknown) {
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
        setSelectedChoreIds([]);
      }
    },
    [targetDate],
  );

  const loadChildrenAndEligible = useCallback(async (): Promise<void> => {
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
      const active = children.filter((child) => child.active);
      setChildrenState({ children, loading: false, error: null });
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

      setEligibleByChildId(Object.fromEntries(results));
    } catch (error: unknown) {
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
    setTargetDate(date);
    setSelectedChoreIds([]);
  }, []);

  const changeSelectedChild = useCallback((childId: string): void => {
    setSelectedChildId(childId);
    setSelectedChoreIds([]);
  }, []);

  const selectToday = useCallback((): void => {
    setTargetDate(buildTodayIsoDate());
    setSelectedChoreIds([]);
  }, []);

  const clearSelectedChores = useCallback((): void => {
    setSelectedChoreIds([]);
  }, []);

  const toggleSelectedChore = useCallback((choreId: number): void => {
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }, []);

  const getEligibleState = useCallback(
    (childId: number): EligibleChildState =>
      eligibleByChildId[childId] ?? EMPTY_ELIGIBLE_STATE,
    [eligibleByChildId],
  );

  return {
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
