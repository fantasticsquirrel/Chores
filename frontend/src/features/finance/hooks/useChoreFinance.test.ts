import { act, renderHook, waitFor } from "@testing-library/react";

import { apiClient } from "../../../api";
import { useChoreFinance } from "./useChoreFinance";

const transaction = {
  id: 41,
  child_id: 11,
  amount_cents: 250,
  type: "BONUS" as const,
  memo: "Great teamwork",
  created_at: "2026-09-05T10:00:00Z",
};

describe("useChoreFinance", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listChildBalances").mockResolvedValue([
      { child_id: 11, child_name: "Riley", balance_cents: 500 },
    ]);
    vi.spyOn(apiClient, "listChoreTransactions").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads balances and the first child's ledger", async () => {
    const { result } = renderHook(() => useChoreFinance());

    await waitFor(() => expect(result.current.selectedChildId).toBe(11));
    await waitFor(() =>
      expect(apiClient.listChoreTransactions).toHaveBeenCalledWith(11),
    );
    expect(result.current.balances).toEqual([
      { child_id: 11, child_name: "Riley", balance_cents: 500 },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("submits the mapped finance payload and clears the form after reload", async () => {
    const createChoreTransaction = vi
      .spyOn(apiClient, "createChoreTransaction")
      .mockResolvedValue(transaction);
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() => expect(result.current.selectedChildId).toBe(11));

    act(() => {
      result.current.setType("BONUS");
      result.current.setAmount("2.50");
      result.current.setMemo("Great teamwork");
    });
    await act(async () => result.current.submit());

    expect(createChoreTransaction).toHaveBeenCalledWith({
      child_id: 11,
      amount_cents: 250,
      type: "BONUS",
      memo: "Great teamwork",
    });
    expect(result.current.amount).toBe("");
    expect(result.current.memo).toBe("");
    expect(result.current.saving).toBe(false);
  });

  it("keeps invalid payment errors visible without calling the API", async () => {
    const createChoreTransaction = vi.spyOn(
      apiClient,
      "createChoreTransaction",
    );
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() => expect(result.current.selectedChildId).toBe(11));

    act(() => result.current.setAmount("-2"));
    await act(async () => result.current.submit());

    expect(result.current.error).toBe("Enter an amount greater than zero.");
    expect(createChoreTransaction).not.toHaveBeenCalled();
  });
});
