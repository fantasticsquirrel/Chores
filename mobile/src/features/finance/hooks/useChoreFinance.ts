import { parseChoreTransactionDraft } from "@family-manager/family-api/finance";
import { useEffect, useState } from "react";

import { apiClient } from "../../../api/client";
import type {
  ChildBalance,
  ChoreTransaction,
  ChoreTransactionType,
} from "../../../api/models";
import { formatError } from "../../../utils/format";

export type ChoreTransactionActionType = Exclude<
  ChoreTransactionType,
  "CHORE_APPROVAL"
>;

export type UseChoreFinanceResult = {
  amount: string;
  balances: ChildBalance[];
  childId: number | null;
  error: string | null;
  memo: string;
  save: () => Promise<void>;
  selectChild: (childId: number) => Promise<void>;
  setAmount: (amount: string) => void;
  setMemo: (memo: string) => void;
  setType: (type: ChoreTransactionActionType) => void;
  transactions: ChoreTransaction[];
  type: ChoreTransactionActionType;
};

export function useChoreFinance(): UseChoreFinanceResult {
  const [balances, setBalances] = useState<ChildBalance[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ChoreTransaction[]>([]);
  const [type, setType] =
    useState<ChoreTransactionActionType>("PAYMENT");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(preferred: number | null = childId) {
    try {
      const rows = await apiClient.listChildBalances();
      const id = preferred ?? rows[0]?.child_id ?? null;
      setBalances(rows);
      setChildId(id);
      setTransactions(
        id === null ? [] : await apiClient.listChoreTransactions(id),
      );
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  useEffect(() => {
    void load(null);
  }, []);

  async function selectChild(selectedChildId: number) {
    setChildId(selectedChildId);
    await load(selectedChildId);
  }

  async function save() {
    if (childId === null) return;
    const parsed = parseChoreTransactionDraft({
      amount,
      childId,
      memo,
      type,
    });
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }
    try {
      await apiClient.createChoreTransaction(parsed.payload);
      setAmount("");
      setMemo("");
      await load(childId);
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  return {
    amount,
    balances,
    childId,
    error,
    memo,
    save,
    selectChild,
    setAmount,
    setMemo,
    setType,
    transactions,
    type,
  };
}
