import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../../../api/client";
import type { Child } from "../../../api/models";
import { formatError } from "../../../utils/format";

export type ChildrenState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

export type UseChildrenResult = {
  loadChildren: () => Promise<void>;
  selectedChildId: number | null;
  setSelectedChildId: (childId: number | null) => void;
  state: ChildrenState;
};

export function useChildren(householdId: number): UseChildrenResult {
  const [state, setState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const loadChildren = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      setState({ children, loading: false, error: null });
      if (children.length > 0) {
        setSelectedChildId((current) => current ?? children[0].id);
      }
    } catch (error) {
      setState({ children: [], loading: false, error: formatError(error) });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  return { loadChildren, selectedChildId, setSelectedChildId, state };
}
