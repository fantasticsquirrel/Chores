import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../../../../api/client";
import { TreeWorkflow } from "./treeWorkflow";
import { TreeRequests } from "./requests";
function setup() {
  const signals: AbortSignal[] = [];
  const fetchImpl = vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal) {
          signals.push(init.signal);
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }
      }),
  );
  const api = createApiClient({
    baseUrl: "https://family.example.test/chore-api",
    fetchImpl,
  });
  const core = new TreeWorkflow(
    api,
    { userId: 1, householdId: 27, role: "PARENT" },
    () => {},
    new TreeRequests(),
  );
  return { core, fetchImpl, signals };
}
describe("feature-owned module discovery actual native HTTP cancellation", () => {
  it("forwards the real owner signal and aborts module discovery on auth invalidation, before any genealogy read", async () => {
    const { core, fetchImpl, signals } = setup();
    const task = core.refresh();
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://family.example.test/chore-api/modules/me",
    );
    expect(fetchImpl.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    core.invalidateAuthentication();
    expect(signals[0].aborted).toBe(true);
    await task;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("replaces and aborts old discovery HTTP on refresh and disposes the new owner", async () => {
    const { core, fetchImpl, signals } = setup();
    const first = core.refresh();
    const second = core.refresh();
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    core.dispose();
    expect(signals[1].aborted).toBe(true);
    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
