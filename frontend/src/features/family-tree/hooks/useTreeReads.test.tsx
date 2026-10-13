import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { TreeRuntimeContext, type TreeRuntime } from "./useTreeCommand";
import { useTreeRead } from "./useTreeReads";
import { ApiClient } from "../../../api";

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const runtime: TreeRuntime = {
    owner: "7:41:session",
    manage: true,
    online: true,
    busy: false,
    floor: { current: 1 },
    revision: () => 1,
    isBusy: () => false,
    setBusy: vi.fn(),
    revoke: vi.fn(),
  };
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <TreeRuntimeContext.Provider value={runtime}>
          {children}
        </TreeRuntimeContext.Provider>
      </QueryClientProvider>
    ),
  };
}
describe("Protected query transport cancellation", () => {
  it("the real API adapter receives the hook signal at fetch and aborts its HTTP read", async () => {
    const { wrapper, client: queryClient } = harness();
    let transportSignal: AbortSignal | undefined;
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          transportSignal = init?.signal ?? undefined;
          transportSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    const client = new ApiClient({
      baseUrl: "http://127.0.0.1:18501/chore-api",
      fetchImpl: fetch,
    });
    const hook = renderHook(
      () =>
        useTreeRead(["graph", 1], (requestOptions) =>
          client.getFamilyTreeGraph({ focus_person_id: 1 }, requestOptions),
        ),
      { wrapper },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(transportSignal).toBeInstanceOf(AbortSignal);
    hook.unmount();
    expect(transportSignal?.aborted).toBe(true);
    queryClient.clear();
  });
  it("passes a real abort signal and aborts obsolete lens/detail reads before publishing", async () => {
    const { wrapper, client } = harness();
    const signals: (AbortSignal | undefined)[] = [],
      resolvers: ((value: { graph_revision: number; name: string }) => void)[] =
        [];
    const load = (options?: { signal?: AbortSignal }) =>
      new Promise<{ graph_revision: number; name: string }>((resolve) => {
        signals.push(options?.signal);
        resolvers.push(resolve);
      });
    const hook = renderHook(
      ({ focus }: { focus: number }) => useTreeRead(["graph", focus], load),
      { wrapper, initialProps: { focus: 1 } },
    );
    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    hook.rerender({ focus: 2 });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      resolvers[1]({ graph_revision: 1, name: "Current focus" });
      resolvers[0]({ graph_revision: 1, name: "Retired focus" });
    });
    await waitFor(() =>
      expect(hook.result.current.data?.name).toBe("Current focus"),
    );
    hook.unmount();
    client.clear();
  });
  it("aborts live reads when the protected observer is unmounted or revoked", async () => {
    const { wrapper, client } = harness();
    let signal: AbortSignal | undefined;
    const hook = renderHook(
      () =>
        useTreeRead(["person", 1], (options?: { signal?: AbortSignal }) => {
          signal = options?.signal;
          return new Promise<{ graph_revision: number }>(() => undefined);
        }),
      { wrapper },
    );
    await waitFor(() => expect(signal).toBeInstanceOf(AbortSignal));
    hook.unmount();
    expect(signal?.aborted).toBe(true);
    client.clear();
  });
});
