import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { apiClient } from "../../../api/client";
import type { ChoreTransaction } from "../../../api/models";
import { useChoreFinance } from "./useChoreFinance";

const transaction: ChoreTransaction = {
  id: 1,
  child_id: 3,
  amount_cents: 250,
  type: "BONUS",
  memo: "Mia only",
  created_at: "2026-10-24T10:00:00Z",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.spyOn(apiClient, "listChildBalances").mockResolvedValue([
    { child_id: 3, child_name: "Mia", balance_cents: 1000 },
    { child_id: 4, child_name: "Leo", balance_cents: 500 },
  ]);
  jest.spyOn(apiClient, "listChoreTransactions").mockResolvedValue([]);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("native finance request ownership", () => {
  it("locks two retained save calls before a render and retains a failed draft", async () => {
    const write = deferred<ChoreTransaction>();
    const create = jest
      .spyOn(apiClient, "createChoreTransaction")
      .mockReturnValue(write.promise);
    const { result } = renderHook(useChoreFinance);
    await waitFor(() => expect(result.current.childId).toBe(3));
    act(() => {
      result.current.setAmount("2.50");
      result.current.setMemo("Keep this");
    });
    const save = result.current.save;
    let first!: Promise<void>;
    act(() => {
      first = save();
      void save();
    });
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      write.reject(new Error("Offline"));
      await first;
    });
    expect(result.current.amount).toBe("2.50");
    expect(result.current.memo).toBe("Keep this");
    expect(result.current.error).toContain("Offline");
    expect(result.current.saving).toBe(false);
  });

  it("loads one history per selection, rejects late history and never rereads balances for selection", async () => {
    const oldHistory = deferred<ChoreTransaction[]>();
    jest
      .mocked(apiClient.listChoreTransactions)
      .mockImplementation((id) =>
        id === 3
          ? oldHistory.promise
          : Promise.resolve([
              { ...transaction, child_id: 4, memo: "Leo only" },
            ]),
      );
    const { result } = renderHook(useChoreFinance);
    await waitFor(() =>
      expect(apiClient.listChoreTransactions).toHaveBeenCalledWith(3),
    );
    await act(async () => result.current.selectChild(4));
    await waitFor(() =>
      expect(result.current.transactions[0]?.memo).toBe("Leo only"),
    );
    await act(async () => oldHistory.resolve([transaction]));
    expect(result.current.transactions[0]?.memo).toBe("Leo only");
    expect(apiClient.listChildBalances).toHaveBeenCalledTimes(1);
    expect(apiClient.listChoreTransactions).toHaveBeenCalledTimes(2);
  });

  it.each(["PAYMENT", "BONUS", "ADJUSTMENT"] as const)(
    "preserves %s payload sign",
    async (type) => {
      const create = jest
        .spyOn(apiClient, "createChoreTransaction")
        .mockResolvedValue(transaction);
      const { result } = renderHook(useChoreFinance);
      await waitFor(() => expect(result.current.childId).toBe(3));
      act(() => {
        result.current.setType(type);
        result.current.setAmount(type === "ADJUSTMENT" ? "-2.50" : "2.50");
      });
      await act(async () => result.current.save());
      expect(create).toHaveBeenCalledWith({
        child_id: 3,
        type,
        amount_cents: type === "ADJUSTMENT" ? -250 : 250,
        memo: "",
      });
    },
  );
});
