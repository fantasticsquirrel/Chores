import { describe, expect, it } from "vitest";
import { TreeRequests } from "./requests";
describe("hook-owned per-request AbortControllers", () => {
  it("actually aborts a replaced graph request without touching a mutation", () => {
    const requests = new TreeRequests();
    const write = requests.begin("mutation");
    const first = requests.begin("graph");
    const next = requests.begin("graph");
    expect(first.signal?.aborted).toBe(true);
    expect(next.signal?.aborted).toBe(false);
    expect(write.signal?.aborted).toBe(false);
  });
  it("late completion cannot unregister a replacement request", () => {
    const requests = new TreeRequests();
    const old = requests.begin("detail");
    const next = requests.begin("detail");
    requests.finish("detail", old);
    requests.cancel("detail");
    expect(next.signal?.aborted).toBe(true);
  });
  it("cancels every obsolete read but preserves write identity until explicit scope teardown", () => {
    const requests = new TreeRequests();
    const graph = requests.begin("graph");
    const page = requests.begin("stories");
    const write = requests.begin("mutation");
    requests.cancelReads();
    expect(graph.signal?.aborted).toBe(true);
    expect(page.signal?.aborted).toBe(true);
    expect(write.signal?.aborted).toBe(false);
    requests.cancelAll();
    expect(write.signal?.aborted).toBe(true);
  });
  it("aborts every household/session-owned request on unmount or denial", () => {
    const requests = new TreeRequests();
    const work = [
      requests.begin("snapshot"),
      requests.begin("people"),
      requests.begin("detail"),
      requests.begin("mutation"),
    ];
    requests.cancelAll();
    expect(work.every((options) => options.signal?.aborted)).toBe(true);
  });
});
