import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  ApiClientError,
  type FamilyTreeGraphParams,
  type FamilyTreeGraphProjection,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { readAtRevision, unionProjection } from "../lib/workflows/workflows";
import { useTreeRuntime } from "./useTreeCommand";
export function useGraphContinuation(
  graph: { data?: FamilyTreeGraphProjection; queryKey: readonly unknown[] },
  params: FamilyTreeGraphParams,
  context: unknown,
) {
  const { busy, online, floor, revoke } = useTreeRuntime();
  const client = useQueryClient();
  const [expanding, setExpanding] = useState(false),
    [expansionError, setExpansionError] = useState<string | null>(null);
  const continuation = useRef<{
    value: number;
    controller: AbortController | null;
  }>({ value: 0, controller: null });
  useEffect(() => {
    const ownership = continuation.current;
    ++ownership.value;
    ownership.controller?.abort();
    setExpanding(false);
    setExpansionError(null);
    return () => {
      ++ownership.value;
      ownership.controller?.abort();
    };
  }, [context, busy, params.focus_person_id]);
  async function more() {
    if (!graph.data?.expansion_token || busy || !online || expanding) return;
    const token = ++continuation.current.value,
      previous = graph.data;
    continuation.current.controller?.abort();
    const controller = new AbortController();
    continuation.current.controller = controller;
    const requestOptions = { signal: controller.signal };
    setExpanding(true);
    setExpansionError(null);
    try {
      const next = await readAtRevision(
        apiClient.getFamilyTreeGraph(
          {
            ...params,
            expansion_token: previous.expansion_token,
          },
          requestOptions,
        ),
        () => floor.current,
      );
      if (token !== continuation.current.value) return;
      const combined = unionProjection(previous, next);
      client.setQueryData(graph.queryKey, combined);
    } catch (error) {
      if (token !== continuation.current.value) return;
      if (
        error instanceof ApiClientError &&
        [401, 403].includes(error.status)
      ) {
        revoke();
        return;
      }
      if (token === continuation.current.value)
        setExpansionError(formatApiError(error));
    } finally {
      if (token === continuation.current.value) setExpanding(false);
    }
  }
  return { expanding, expansionError, more };
}
