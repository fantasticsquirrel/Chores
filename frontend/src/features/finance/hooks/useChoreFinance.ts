import {
  parseChoreTransactionDraft,
  type ChoreTransactionActionType,
} from "@family-manager/family-api/finance";
import { useCallback, useEffect, useState } from "react";

import {
  apiClient,
  type ChildBalance,
  type ChoreTransaction,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";

export type UseChoreFinanceResult = {
  amount: string;
  balances: ChildBalance[];
  error: string | null;
  load: () => Promise<void>;
  memo: string;
  saving: boolean;
  selectChild: (childId: number) => Promise<void>;
  selectedChildId: number | null;
  setAmount: (amount: string) => void;
  setMemo: (memo: string) => void;
  setType: (type: ChoreTransactionActionType) => void;
  submit: () => Promise<void>;
  transactions: ChoreTransaction[];
  type: ChoreTransactionActionType;
};

export function useChoreFinance(): UseChoreFinanceResult {
  const [balances, setBalances] = useState<ChildBalance[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ChoreTransaction[]>([]);
  const [type, setType] = useState<ChoreTransactionActionType>("PAYMENT");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const rows = await apiClient.listChildBalances();
      setBalances(rows);
      const childId = selectedChildId ?? rows[0]?.child_id ?? null;
      setSelectedChildId(childId);
      setTransactions(
        childId === null ? [] : await apiClient.listChoreTransactions(childId),
      );
      setError(null);
    } catch (caught: unknown) {
      setError(formatApiError(caught));
    }
  }, [selectedChildId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectChild(childId: number): Promise<void> {
    setSelectedChildId(childId);
    try {
      setTransactions(await apiClient.listChoreTransactions(childId));
    } catch (caught: unknown) {
      setError(formatApiError(caught));
    }
  }

  async function submit(): Promise<void> {
    if (selectedChildId === null) return;

    const parsed = parseChoreTransactionDraft({
      amount,
      childId: selectedChildId,
      memo,
      type,
    });
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    try {
      await apiClient.createChoreTransaction(parsed.payload);
      setAmount("");
      setMemo("");
      await load();
    } catch (caught: unknown) {
      setError(formatApiError(caught));
    } finally {
      setSaving(false);
    }
  }

  return {
    amount,
    balances,
    error,
    load,
    memo,
    saving,
    selectChild,
    selectedChildId,
    setAmount,
    setMemo,
    setType,
    submit,
    transactions,
    type,
  };
}
