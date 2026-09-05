import { useCallback, useEffect, useState } from "react";

import { apiClient, type Child } from "../../../api";
import { formatApiError } from "../../../lib/errors";

export type ChildrenState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

type UseChildrenResult = {
  loadChildren: () => Promise<void>;
  selectedChildId: number | null;
  setSelectedChildId: (childId: number | null) => void;
  state: ChildrenState;
};

export function useChildren(householdId: number | null): UseChildrenResult {
  const [state, setState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const loadChildren = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setState({
        children: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      setState({ children, loading: false, error: null });
      if (children.length > 0) {
        setSelectedChildId((current) => current ?? children[0].id);
      }
    } catch (error: unknown) {
      setState({
        children: [],
        loading: false,
        error: formatApiError(error),
      });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  return { loadChildren, selectedChildId, setSelectedChildId, state };
}
