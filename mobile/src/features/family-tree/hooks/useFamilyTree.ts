import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { apiClient } from "../../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../../api/models";
import { TreeWorkflow } from "../lib/workflows/treeWorkflow";
import { TreeRequests } from "../lib/workflows/requests";
export function useFamilyTree(
  session: AuthSessionResponse,
  onModulesLoaded: (modules: FamilyModule[]) => void,
) {
  const publish = useRef(onModulesLoaded);
  publish.current = onModulesLoaded;
  const requests = useMemo(
    () => new TreeRequests(),
    [session.user.id, session.user.household_id, session.user.role],
  );
  const workflow = useMemo(
    () =>
      new TreeWorkflow(
        apiClient,
        {
          userId: session.user.id,
          householdId: session.user.household_id,
          role: session.user.role,
        },
        (modules) => publish.current(modules),
        requests,
      ),
    [session.user.id, session.user.household_id, session.user.role, requests],
  );
  const state = useSyncExternalStore(
    workflow.subscribe,
    workflow.snapshot,
    workflow.snapshot,
  );
  useEffect(() => {
    const unsubscribe = apiClient.subscribeAuthentication(() =>
      workflow.invalidateAuthentication(),
    );
    void workflow.refresh();
    return () => {
      unsubscribe();
      requests.cancelAll();
      workflow.dispose();
    };
  }, [workflow]);
  return { state, workflow };
}
