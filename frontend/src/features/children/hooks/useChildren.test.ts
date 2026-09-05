import { act, renderHook, waitFor } from "@testing-library/react";

import { ApiClientError, apiClient } from "../../../api";
import { useChildren } from "./useChildren";

describe("useChildren", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads children in the household and selects the first child", async () => {
    const listChildren = vi.spyOn(apiClient, "listChildren").mockResolvedValue([
      { id: 11, household_id: 7, name: "Riley", active: true },
      { id: 12, household_id: 7, name: "Sam", active: false },
    ]);

    const { result } = renderHook(() => useChildren(7));

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.children).toHaveLength(2);
    expect(result.current.selectedChildId).toBe(11);
    expect(listChildren).toHaveBeenCalledWith({ household_id: 7 });

    act(() => result.current.setSelectedChildId(12));
    await act(async () => result.current.loadChildren());
    expect(result.current.selectedChildId).toBe(12);
  });

  it("keeps missing household scope and API failures in the loading state", async () => {
    const listChildren = vi
      .spyOn(apiClient, "listChildren")
      .mockRejectedValue(
        new ApiClientError(503, "Unavailable", { detail: "Unavailable" }),
      );
    const { result, rerender } = renderHook(
      ({ householdId }: { householdId: number | null }) =>
        useChildren(householdId),
      { initialProps: { householdId: 7 as number | null } },
    );

    await waitFor(() => expect(result.current.state.error).toBe("Unavailable"));
    rerender({ householdId: null });
    await waitFor(() =>
      expect(result.current.state.error).toBe(
        "Could not determine household scope.",
      ),
    );
    expect(result.current.state.loading).toBe(false);
    expect(listChildren).toHaveBeenCalledOnce();
  });
});
