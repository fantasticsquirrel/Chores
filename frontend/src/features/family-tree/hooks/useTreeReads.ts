import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiClientError } from "../../../api";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import { abortableRead } from "../lib/workflows/workflows";
import { useTreeRuntime } from "./useTreeCommand";

export function useTreeRead<T>(
  key: readonly unknown[],
  load: (options: RequestOptions) => Promise<T>,
  enabled = true,
) {
  const runtime = useTreeRuntime(),
    queryKey = ["family-tree", runtime.owner, ...key];
  const query = useQuery({
    queryKey,
    enabled: enabled && !runtime.busy && !runtime.checking,
    queryFn: ({ signal }) =>
      abortableRead(signal, (options) =>
        runtime.checking || !runtime.online
          ? Promise.reject(
              new Error("Access is being checked or the client is offline."),
            )
          : load(options),
      )
        .then((response) => {
          if (
            response &&
            typeof response === "object" &&
            "graph_revision" in response &&
            Number(response.graph_revision) < runtime.floor.current
          )
            throw new Error("Stale read discarded; refresh the latest tree.");
          return response;
        })
        .catch((error) => {
          if (
            error instanceof ApiClientError &&
            [401, 403].includes(error.status)
          )
            runtime.revoke();
          throw error;
        }),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  return { ...query, queryKey };
}
export function useTreePages<
  T extends { id: number },
  P extends { graph_revision: number; items: T[]; next_cursor: number | null },
>(
  key: readonly unknown[],
  load: (cursor: number | null, options: RequestOptions) => Promise<P>,
  enabled = true,
) {
  const runtime = useTreeRuntime(),
    client = useQueryClient(),
    queryKey = ["family-tree", runtime.owner, ...key];
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as number | null,
    enabled: enabled && !runtime.busy && !runtime.checking,
    queryFn: ({ pageParam, signal }) =>
      abortableRead(signal, (options) =>
        runtime.checking || !runtime.online
          ? Promise.reject(
              new Error("Access is being checked or the client is offline."),
            )
          : load(pageParam, options),
      )
        .then((response) => {
          if (response.graph_revision < runtime.floor.current)
            throw new Error("Stale page discarded; refresh the latest tree.");
          return response;
        })
        .catch((error) => {
          if (
            error instanceof ApiClientError &&
            [401, 403].includes(error.status)
          )
            runtime.revoke();
          throw error;
        }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const pages = query.data?.pages ?? [],
    revision = pages[0]?.graph_revision,
    consistent = pages.every((page) => page.graph_revision === revision);
  const items = consistent
    ? [
        ...new Map(
          pages.flatMap((page) => page.items).map((item) => [item.id, item]),
        ).values(),
      ]
    : [];
  return {
    ...query,
    items,
    consistent,
    revision,
    refresh: () => client.resetQueries({ queryKey, exact: true }),
  };
}
