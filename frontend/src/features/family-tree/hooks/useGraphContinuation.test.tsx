import { it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TreeRuntimeContext, type TreeRuntime } from "./useTreeCommand";
import { useGraphContinuation } from "./useGraphContinuation";
import { apiClient } from "../../../api";
import { graph } from "../forms/testFixtures";
it("changing the derived route focus with identical query parameters aborts and retires graph continuation", async () => {
  const projection = { ...graph(), expansion_token: "literal-continuation" };
  const runtime: TreeRuntime = {
    owner: "7:41",
    manage: true,
    online: true,
    busy: false,
    isBusy: () => false,
    setBusy: vi.fn(),
    floor: { current: 1 },
    revision: () => 1,
    revoke: vi.fn(),
  };
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TreeRuntimeContext.Provider value={runtime}>
        {children}
      </TreeRuntimeContext.Provider>
    </QueryClientProvider>
  );
  let signal: AbortSignal | undefined,
    resolve: (value: typeof projection) => void = () => {};
  const load = vi
    .spyOn(apiClient, "getFamilyTreeGraph")
    .mockImplementation((_params, options) => {
      signal = options?.signal;
      return new Promise((done) => {
        resolve = done;
      });
    });
  const hook = renderHook(
    ({ focus }) =>
      useGraphContinuation(
        { data: projection, queryKey: ["family-tree", "7:41", "graph", focus] },
        { focus_person_id: focus },
        "unchanged query params",
      ),
    { wrapper, initialProps: { focus: 1 } },
  );
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = hook.result.current.more();
  });
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  hook.rerender({ focus: 2 });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    resolve(projection);
    await pending;
  });
  expect(hook.result.current.expanding).toBe(false);
  expect(
    client.getQueryData(["family-tree", "7:41", "graph", 1]),
  ).toBeUndefined();
  hook.unmount();
  client.clear();
  load.mockRestore();
});
