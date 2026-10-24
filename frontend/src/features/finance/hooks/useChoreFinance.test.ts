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

  it("owns exactly one history request per selection without reloading balances", async () => {
    vi.mocked(apiClient.listChildBalances).mockResolvedValue([
      { child_id: 11, child_name: "Riley", balance_cents: 500 },
      { child_id: 12, child_name: "Robin", balance_cents: 600 },
    ]);
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() => expect(result.current.selectedChildId).toBe(11));
    await act(async () => result.current.selectChild(12));
    await waitFor(() =>
      expect(apiClient.listChoreTransactions).toHaveBeenCalledWith(12),
    );
    expect(apiClient.listChildBalances).toHaveBeenCalledTimes(1);
    expect(apiClient.listChoreTransactions).toHaveBeenCalledTimes(2);
  });

  it("rejects a late history response after selecting another child", async () => {
    let resolveOld!: (rows: (typeof transaction)[]) => void;
    vi.mocked(apiClient.listChoreTransactions).mockImplementation((id) =>
      id === 11
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve([
            { ...transaction, child_id: 12, memo: "Robin only" },
          ]),
    );
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() =>
      expect(apiClient.listChoreTransactions).toHaveBeenCalledWith(11),
    );
    await act(async () => result.current.selectChild(12));
    await waitFor(() =>
      expect(result.current.transactions[0]?.memo).toBe("Robin only"),
    );
    await act(async () => resolveOld([transaction]));
    expect(result.current.transactions[0]?.memo).toBe("Robin only");
  });

  it("locks same-tick submissions and preserves failed drafts", async () => {
    let reject!: (error: Error) => void;
    const create = vi
      .spyOn(apiClient, "createChoreTransaction")
      .mockImplementation(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      );
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() => expect(result.current.selectedChildId).toBe(11));
    act(() => {
      result.current.setAmount("2");
      result.current.setMemo("Keep me");
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.submit();
      void result.current.submit();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);
    await act(async () => {
      reject(new Error("Offline"));
      await pending;
    });
    expect(result.current.amount).toBe("2");
    expect(result.current.memo).toBe("Keep me");
    expect(result.current.error).toContain("Offline");
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

  it.each(["PAYMENT", "BONUS", "ADJUSTMENT"] as const)(
    "preserves %s payload signs",
    async (type) => {
      const create = vi
        .spyOn(apiClient, "createChoreTransaction")
        .mockResolvedValue(transaction);
      const { result } = renderHook(() => useChoreFinance());
      await waitFor(() => expect(result.current.selectedChildId).toBe(11));
      act(() => {
        result.current.setType(type);
        result.current.setAmount(type === "ADJUSTMENT" ? "-2.50" : "2.50");
      });
      await act(async () => result.current.submit());
      expect(create).toHaveBeenCalledWith({
        child_id: 11,
        amount_cents: type === "ADJUSTMENT" ? -250 : 250,
        type,
        memo: "",
      });
    },
  );

  it("does not label a confirmed write as failed when revalidation fails", async () => {
    vi.spyOn(apiClient, "createChoreTransaction").mockResolvedValue(
      transaction,
    );
    const { result } = renderHook(() => useChoreFinance());
    await waitFor(() => expect(result.current.selectedChildId).toBe(11));
    vi.mocked(apiClient.listChildBalances).mockRejectedValueOnce(
      new Error("Balance offline"),
    );
    act(() => result.current.setAmount("2.50"));
    await act(async () => result.current.submit());
    expect(result.current.success).toBe("Payment recorded for Riley.");
    expect(result.current.error).toBeNull();
    expect(result.current.balancesError).toBe("Balance offline");
    expect(result.current.amount).toBe("");
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
