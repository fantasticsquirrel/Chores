import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TreeRuntimeContext, type TreeRuntime } from "./useTreeCommand";
import { useTreeTask } from "./useTreeTask";
import { ApiClientError } from "../../../api";
function runtime(extra: Partial<TreeRuntime> = {}): TreeRuntime {
  return {
    owner: "7:41:1",
    manage: true,
    authorizedManage: true,
    online: true,
    busy: false,
    isBusy: () => false,
    setBusy: vi.fn(),
    checking: false,
    floor: { current: 1 },
    revision: () => 1,
    revoke: vi.fn(),
    ...extra,
  };
}
describe("protected preview/file task ownership", () => {
  it("aborts an actual managed task on affirmative manage revocation and rejects late publication", async () => {
    let value = runtime();
    let signal: AbortSignal | undefined;
    let resolve: (value: string) => void = () => {};
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TreeRuntimeContext.Provider value={value}>
        {children}
      </TreeRuntimeContext.Provider>
    );
    const hook = renderHook(() => useTreeTask(), { wrapper });
    let pending: Promise<string | null> = Promise.resolve(null);
    act(() => {
      pending = hook.result.current.run((options) => {
        signal = options.signal;
        return new Promise<string>((done) => {
          resolve = done;
        });
      });
    });
    await waitFor(() => expect(signal).toBeInstanceOf(AbortSignal));
    value = { ...value, manage: false, authorizedManage: false };
    hook.rerender();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve("retired protected content");
      expect(await pending).toBeNull();
    });
  });
  it.each([{ online: false }, { manage: false }, { checking: true }])(
    "never starts a managed task while unavailable %j",
    async (extra) => {
      const value = runtime(extra);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TreeRuntimeContext.Provider value={value}>
          {children}
        </TreeRuntimeContext.Provider>
      );
      const hook = renderHook(() => useTreeTask(), { wrapper }),
        operation = vi.fn(async () => "protected");
      await act(async () =>
        expect(await hook.result.current.run(operation)).toBeNull(),
      );
      expect(operation).not.toHaveBeenCalled();
    },
  );
  it("a view-only photograph read remains possible but 403 retires the protected owner", async () => {
    const value = runtime({ manage: false, authorizedManage: false });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TreeRuntimeContext.Provider value={value}>
        {children}
      </TreeRuntimeContext.Provider>
    );
    const hook = renderHook(() => useTreeTask(false), { wrapper });
    await act(async () =>
      expect(
        await hook.result.current.run(async () => "authorized byte read"),
      ).toBe("authorized byte read"),
    );
    await act(async () => {
      await hook.result.current.run(async () => {
        throw new ApiClientError(403, "Denied", undefined);
      });
    });
    expect(value.revoke).toHaveBeenCalledTimes(1);
  });
});
