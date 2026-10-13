import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { useTreeRuntime } from "./useTreeCommand";
import { useTreeTask } from "./useTreeTask";
/** Explicit current-record review for staging/preview conflicts, never reapply. */
export function useTreeRefresh() {
  const runtime = useTreeRuntime(),
    client = useQueryClient(),
    task = useTreeTask();
  const [pending, setPending] = useState(false);
  async function reload() {
    if (pending) return false;
    setPending(true);
    try {
      const latest = await task.run((options) =>
        apiClient.getFamilyTreeCollection(options),
      );
      if (!latest) return false;
      if (latest.graph_revision < runtime.floor.current) {
        task.setError(
          "The collection review is stale. Retry loading current records.",
        );
        return false;
      }
      runtime.floor.current = latest.graph_revision;
      client.setQueryData(["family-tree", runtime.owner, "collection"], latest);
      try {
        await client.invalidateQueries(
          { queryKey: ["family-tree", runtime.owner], refetchType: "all" },
          { throwOnError: true },
        );
        return true;
      } catch (error) {
        task.setError(formatApiError(error));
        return false;
      }
    } finally {
      setPending(false);
    }
  }
  return { reload, error: task.error, pending };
}
