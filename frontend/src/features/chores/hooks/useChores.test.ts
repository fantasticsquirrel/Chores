import { renderHook, waitFor } from "@testing-library/react";

import { ApiClientError, apiClient, type Chore } from "../../../api";
import { useChores } from "./useChores";

function chore(): Chore {
  return {
    id: 21,
    household_id: 7,
    owner_user_id: null,
    name: "Laundry",
    reward_cents: 250,
    reward_dollars: 2.5,
    start_date: "2026-09-05",
    expires_at: null,
    timeout_days: null,
    schedule_mode: "NONE",
    schedule_interval: null,
    schedule_unit: null,
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    archived_at: null,
    is_active: true,
    allowed_child_ids: [],
    rotation_order: [],
  };
}

describe("useChores", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads household chores and parent tasks with their existing scopes", async () => {
    const listChores = vi
      .spyOn(apiClient, "listChores")
      .mockResolvedValue([chore()]);
    const listMyParentTasks = vi
      .spyOn(apiClient, "listMyParentTasks")
      .mockResolvedValue([chore()]);

    const { result } = renderHook(() =>
      useChores({
        householdId: 7,
        targetDate: "2026-09-05",
        userId: 31,
      }),
    );

    await waitFor(() => expect(result.current.choresState.loading).toBe(false));
    expect(result.current.choresState.chores).toEqual([chore()]);
    expect(result.current.myTasks).toEqual([chore()]);
    expect(listChores).toHaveBeenCalledWith({
      household_id: 7,
      active_only: false,
    });
    expect(listMyParentTasks).toHaveBeenCalledWith("2026-09-05");
  });

  it("keeps household scope errors and API errors in the chore state", async () => {
    vi.spyOn(apiClient, "listChores").mockRejectedValue(
      new ApiClientError(503, "Unavailable", { detail: "Unavailable" }),
    );
    vi.spyOn(apiClient, "listMyParentTasks").mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ householdId }: { householdId: number | null }) =>
        useChores({
          householdId,
          targetDate: "2026-09-05",
          userId: 31,
        }),
      { initialProps: { householdId: 7 as number | null } },
    );

    await waitFor(() =>
      expect(result.current.choresState.error).toBe("Unavailable"),
    );
    rerender({ householdId: null });
    await waitFor(() =>
      expect(result.current.choresState.error).toBe(
        "Could not determine household scope.",
      ),
    );
  });
});
