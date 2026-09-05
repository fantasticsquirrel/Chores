import { act, renderHook, waitFor } from "@testing-library/react";

import { apiClient, type Child, type EligibleChore } from "../../../api";
import { useEligibleChores } from "./useEligibleChores";

const children: Child[] = [
  { id: 11, household_id: 7, name: "Riley", active: true },
  { id: 12, household_id: 7, name: "Maya", active: false },
];

const eligibleChore: EligibleChore = {
  chore_id: 77,
  name: "Wipe table",
  reward_cents: 100,
  occurrence_date: "2026-09-05",
  expires_on: null,
};

describe("useEligibleChores", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads active children, scopes eligibility requests, and owns selection resets", async () => {
    const listChildren = vi
      .spyOn(apiClient, "listChildren")
      .mockResolvedValue(children);
    const listEligibleChores = vi
      .spyOn(apiClient, "listEligibleChores")
      .mockResolvedValue([eligibleChore]);

    const { result } = renderHook(() => useEligibleChores(7));

    await waitFor(() =>
      expect(result.current.childrenState.loading).toBe(false),
    );
    expect(result.current.activeChildren).toEqual([children[0]]);
    expect(result.current.selectedChild).toEqual(children[0]);
    expect(result.current.selectedEligibleState.chores).toEqual([
      eligibleChore,
    ]);
    expect(listChildren).toHaveBeenCalledWith({ household_id: 7 });
    expect(listEligibleChores).toHaveBeenCalledWith({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
      child_id: 11,
    });
    expect(listEligibleChores).not.toHaveBeenCalledWith(
      expect.objectContaining({ child_id: 12 }),
    );

    act(() => result.current.toggleSelectedChore(77));
    expect(result.current.selectedChoreIds).toEqual([77]);
    act(() => result.current.changeTargetDate("2026-09-06"));
    expect(result.current.selectedChoreIds).toEqual([]);

    await waitFor(() =>
      expect(listEligibleChores).toHaveBeenCalledWith({
        date: "2026-09-06",
        child_id: 11,
      }),
    );
  });

  it("reports a missing household without making scoped API calls", async () => {
    const listChildren = vi.spyOn(apiClient, "listChildren");
    const listEligibleChores = vi.spyOn(apiClient, "listEligibleChores");

    const { result } = renderHook(() => useEligibleChores(null));

    await waitFor(() =>
      expect(result.current.childrenState.loading).toBe(false),
    );
    expect(result.current.childrenState.error).toBe(
      "Could not determine household scope.",
    );
    expect(listChildren).not.toHaveBeenCalled();
    expect(listEligibleChores).not.toHaveBeenCalled();
  });
});
