import { act, renderHook, waitFor } from "@testing-library/react";
import { useDiscoveryRead } from "./useDiscoveryRead";

describe("Discovery scoped reads", () => {
  it("does not let an older GET overwrite a completed mutation", async () => {
    let complete!: (value: string) => void;
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useDiscoveryRead("household:child", read),
    );
    act(() => result.current.replace("saved choice"));
    await act(async () => {
      complete("old choice");
    });
    expect(result.current.data).toBe("saved choice");
  });
  it("retires old data immediately when the viewer changes", async () => {
    let complete!: (value: string) => void;
    const read = vi
      .fn()
      .mockResolvedValueOnce("child A")
      .mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            complete = resolve;
          }),
      );
    const { result, rerender } = renderHook(
      ({ id }) => useDiscoveryRead<string>(id, read),
      { initialProps: { id: "A" } },
    );
    await waitFor(() => expect(result.current.data).toBe("child A"));
    rerender({ id: "B" });
    expect(result.current.data).toBeNull();
    await act(async () => complete("child B"));
    expect(result.current.data).toBe("child B");
  });
  it("ignores a stale success after a newer denied refresh", async () => {
    let complete!: (value: string) => void;
    const read = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            complete = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("Access denied"));
    const { result } = renderHook(() =>
      useDiscoveryRead<string>("child", read),
    );
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe("Access denied"));
    await act(async () => complete("private result"));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Access denied");
  });
});
