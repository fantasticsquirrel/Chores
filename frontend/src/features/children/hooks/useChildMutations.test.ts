import { act, renderHook } from "@testing-library/react";

import { ApiClientError, apiClient, type Child } from "../../../api";
import { useChildMutations } from "./useChildMutations";

const child: Child = {
  id: 11,
  household_id: 7,
  name: "Riley",
  active: true,
};

describe("useChildMutations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("trims child names, preserves household scope, and reloads after create", async () => {
    const createChild = vi.spyOn(apiClient, "createChild").mockResolvedValue({
      ...child,
      name: "Sam",
      active: false,
    });
    const loadChildren = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useChildMutations({ householdId: 7, loadChildren }),
    );

    act(() => {
      result.current.setNameInput("  Sam  ");
      result.current.setActiveOnCreate(false);
    });
    await act(async () => result.current.createChild());

    expect(createChild).toHaveBeenCalledWith({
      household_id: 7,
      name: "Sam",
      active: false,
    });
    expect(loadChildren).toHaveBeenCalledOnce();
    expect(result.current.nameInput).toBe("");
    expect(result.current.activeOnCreate).toBe(true);
    expect(result.current.submitting).toBe(false);
  });

  it("keeps update errors visible without refreshing children", async () => {
    vi.spyOn(apiClient, "updateChild").mockRejectedValue(
      new ApiClientError(409, "Concurrent update conflict", {
        detail: "Concurrent update conflict",
      }),
    );
    const loadChildren = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useChildMutations({ householdId: 7, loadChildren }),
    );

    await act(async () => result.current.toggleActive(child));

    expect(apiClient.updateChild).toHaveBeenCalledWith(11, {
      household_id: 7,
      active: false,
    });
    expect(result.current.submitError).toBe("Concurrent update conflict");
    expect(result.current.updatingChildId).toBeNull();
    expect(loadChildren).not.toHaveBeenCalled();
  });

  it("validates names before attempting a scoped create", async () => {
    const createChild = vi.spyOn(apiClient, "createChild");
    const { result } = renderHook(() =>
      useChildMutations({
        householdId: null,
        loadChildren: vi.fn(async () => undefined),
      }),
    );

    await act(async () => result.current.createChild());
    expect(result.current.submitError).toBe("Child name is required.");
    expect(createChild).not.toHaveBeenCalled();
  });
});
