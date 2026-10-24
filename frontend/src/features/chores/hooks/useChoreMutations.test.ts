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
    const loadChildrenAndEligible = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChoreMutations({
        canSubmitChores: () => true,
        clearSelectedChores: vi.fn(),
        householdId: 7,
        loadChildrenAndEligible,
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
    expect(loadChildrenAndEligible).toHaveBeenCalledOnce();
    expect(patchEligibleChildState).toHaveBeenLastCalledWith(11, {
      message: "Submitted Wipe table for review.",
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
    const loadChildrenAndEligible = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChoreMutations({
        canSubmitChores: () => true,
        clearSelectedChores,
        householdId: 7,
        loadChildrenAndEligible,
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
    expect(loadChildrenAndEligible).toHaveBeenCalledOnce();
    expect(result.current.selectedSubmitting).toBe(false);
  });
});

it("rejects retained quick and selected handlers synchronously when the date scope changes", async () => {
  const { useEligibleChores } = await import("./useEligibleChores");
  vi.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
  vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([eligibleChore]);
  const submit = vi.spyOn(apiClient, "createSubmission");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const { result } = renderHook(() => {
    const data = useEligibleChores(7, { childId: "11", date: "2026-09-05" });
    const mutations = useChoreMutations({
      ...data,
      householdId: 7,
      userId: 31,
      loadChores: async () => undefined,
      loadMyTasks: async () => undefined,
      setChoresError: vi.fn(),
    });
    return { data, mutations };
  });
  await act(async () => undefined);
  act(() => result.current.data.toggleSelectedChore(77));
  expect(result.current.data.selectedChoreIds).toEqual([77]);
  const quick = result.current.mutations.handleQuickSubmit;
  const selected = result.current.mutations.handleSelectedSubmit;
  vi.mocked(apiClient.listChildren).mockImplementationOnce(
    () => new Promise(() => {}),
  );
  await act(async () => {
    result.current.data.changeTargetDate("2026-09-06");
    await quick(child, eligibleChore);
    await selected();
  });
  await act(async () => {
    await quick(child, eligibleChore);
    await selected();
  });
  expect(submit).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(result.current.data.selectedChoreIds).toEqual([]);
  vi.restoreAllMocks();
});
