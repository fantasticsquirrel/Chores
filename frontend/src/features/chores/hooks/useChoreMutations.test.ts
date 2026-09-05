import { act, renderHook } from "@testing-library/react";

import { apiClient, type Child, type EligibleChore } from "../../../api";
import { useChoreMutations } from "./useChoreMutations";

const child: Child = {
  id: 11,
  household_id: 7,
  name: "Riley",
  active: true,
};

const eligibleChore: EligibleChore = {
  chore_id: 77,
  name: "Wipe table",
  reward_cents: 100,
  occurrence_date: "2026-09-05",
  expires_on: null,
};

describe("useChoreMutations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("quick-submits with child scope and preserves the success message on refresh", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const createSubmission = vi
      .spyOn(apiClient, "createSubmission")
      .mockResolvedValue({
        id: 1,
        child_id: 11,
        for_date: "2026-09-05",
        status: "PENDING",
        items: [{ chore_id: 77, status: "PENDING" }],
      });
    const patchEligibleChildState = vi.fn();
    const refreshEligibleForChild = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChoreMutations({
        clearSelectedChores: vi.fn(),
        householdId: 7,
        loadChildrenAndEligible: vi.fn(async () => undefined),
        loadChores: vi.fn(async () => undefined),
        loadMyTasks: vi.fn(async () => undefined),
        patchEligibleChildState,
        refreshEligibleForChild,
        selectedChild: child,
        selectedChoreIds: [77],
        setChoresError: vi.fn(),
        targetDate: "2026-09-05",
        userId: 31,
      }),
    );

    await act(async () =>
      result.current.handleQuickSubmit(child, eligibleChore),
    );

    expect(createSubmission).toHaveBeenCalledWith(
      { for_date: "2026-09-05", chore_ids: [77] },
      { child_id: 11 },
    );
    expect(patchEligibleChildState).toHaveBeenNthCalledWith(1, 11, {
      submittingChoreId: 77,
      error: null,
      message: null,
    });
    expect(patchEligibleChildState).toHaveBeenNthCalledWith(2, 11, {
      message: "Submitted Wipe table for review.",
      submittingChoreId: null,
    });
    expect(refreshEligibleForChild).toHaveBeenCalledWith(11, {
      preserveMessage: true,
    });
  });

  it("submits the selected chores then clears and refreshes the selection", async () => {
    vi.spyOn(apiClient, "createSubmission").mockResolvedValue({
      id: 1,
      child_id: 11,
      for_date: "2026-09-05",
      status: "PENDING",
      items: [{ chore_id: 77, status: "PENDING" }],
    });
    const clearSelectedChores = vi.fn();
    const refreshEligibleForChild = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChoreMutations({
        clearSelectedChores,
        householdId: 7,
        loadChildrenAndEligible: vi.fn(async () => undefined),
        loadChores: vi.fn(async () => undefined),
        loadMyTasks: vi.fn(async () => undefined),
        patchEligibleChildState: vi.fn(),
        refreshEligibleForChild,
        selectedChild: child,
        selectedChoreIds: [77],
        setChoresError: vi.fn(),
        targetDate: "2026-09-05",
        userId: 31,
      }),
    );

    await act(async () => result.current.handleSelectedSubmit());

    expect(result.current.selectedSubmitSuccess).toBe(
      "Submitted 1 chore(s) for Riley.",
    );
    expect(clearSelectedChores).toHaveBeenCalledOnce();
    expect(refreshEligibleForChild).toHaveBeenCalledWith(11);
    expect(result.current.selectedSubmitting).toBe(false);
  });
});
