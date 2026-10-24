import {
  parseChoreTransactionDraft,
  type ChoreTransactionActionType,
} from "@family-manager/family-api/finance";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiClient,
  type ChildBalance,
  type ChoreTransaction,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";

export type UseChoreFinanceResult = {
  amount: string;
  balances: ChildBalance[];
  balancesError: string | null;
  balancesLoading: boolean;
  error: string | null;
  historyError: string | null;
  historyLoading: boolean;
  load: () => Promise<void>;
  loadBalances: () => Promise<void>;
  loadHistory: () => Promise<void>;
  memo: string;
  saving: boolean;
  selectChild: (childId: number) => Promise<void>;
  selectedChildId: number | null;
  setAmount: (amount: string) => void;
  setMemo: (memo: string) => void;
  setType: (type: ChoreTransactionActionType) => void;
  submit: () => Promise<void>;
  success: string | null;
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
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const selected = useRef<number | null>(null);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const balanceRequest = useRef(0);
  const historyRequest = useRef(0);

  const loadBalances = useCallback(async (): Promise<void> => {
    const request = ++balanceRequest.current;
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const rows = await apiClient.listChildBalances();
      if (!alive.current || request !== balanceRequest.current) return;
      setBalances(rows);
      const id = rows.some((row) => row.child_id === selected.current)
        ? selected.current
        : (rows[0]?.child_id ?? null);
      if (selected.current !== id) {
        selected.current = id;
        historyRequest.current += 1;
        setTransactions([]);
        setSelectedChildId(id);
      }
    } catch (caught) {
      if (alive.current && request === balanceRequest.current)
        setBalancesError(formatApiError(caught));
    } finally {
      if (alive.current && request === balanceRequest.current)
        setBalancesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (): Promise<void> => {
    const id = selected.current;
    const request = ++historyRequest.current;
    if (id === null) {
      setTransactions([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await apiClient.listChoreTransactions(id);
      if (
        alive.current &&
        request === historyRequest.current &&
        selected.current === id
      )
        setTransactions(rows);
    } catch (caught) {
      if (
        alive.current &&
        request === historyRequest.current &&
        selected.current === id
      )
        setHistoryError(formatApiError(caught));
    } finally {
      if (
        alive.current &&
        request === historyRequest.current &&
        selected.current === id
      )
        setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void loadBalances();
    return () => {
      alive.current = false;
      balanceRequest.current += 1;
      historyRequest.current += 1;
    };
  }, [loadBalances]);

  // Selection owns history loading. It never reloads unrelated balances.
  useEffect(() => {
    void loadHistory();
  }, [selectedChildId, loadHistory]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [success]);

  async function selectChild(childId: number): Promise<void> {
    if (saveLock.current || selected.current === childId) return;
    selected.current = childId;
    historyRequest.current += 1;
    setTransactions([]);
    setHistoryLoading(true);
    setHistoryError(null);
    setError(null);
    setSuccess(null);
    setSelectedChildId(childId);
  }

  async function load(): Promise<void> {
    await Promise.all([loadBalances(), loadHistory()]);
  }

  async function submit(): Promise<void> {
    if (saveLock.current || selected.current === null) return;
    const parsed = parseChoreTransactionDraft({
      amount,
      childId: selected.current,
      memo,
      type,
    });
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }
    // React state alone does not protect two calls made before the next render.
    saveLock.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const recipient =
      balances.find((row) => row.child_id === parsed.payload.child_id)
        ?.child_name ?? "selected child";
    try {
      await apiClient.createChoreTransaction(parsed.payload);
      if (!alive.current) return;
      setAmount("");
      setMemo("");
      setSuccess(
        `${type === "PAYMENT" ? "Payment" : type === "BONUS" ? "Bonus" : "Adjustment"} recorded for ${recipient}.`,
      );
      // Refresh errors stay separate from the confirmed write. Never invite a duplicate retry.
      await load();
    } catch (caught) {
      if (alive.current)
        setError(
          `Could not record activity: ${formatApiError(caught)} Your entries are unchanged.`,
        );
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return {
    amount,
    balances,
    balancesError,
    balancesLoading,
    error,
    historyError,
    historyLoading,
    load,
    loadBalances,
    loadHistory,
    memo,
    saving,
    selectChild,
    selectedChildId,
    setAmount,
    setMemo,
    setType,
    submit,
    success,
    transactions,
    type,
  };
}
