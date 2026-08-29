import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { apiClient, type ChildBalance, type ChoreTransaction, type ChoreTransactionType } from "../api";
import { useAuth } from "../auth/useAuth";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function ChoreFinancePage(): ReactElement {
  const { user } = useAuth();
  const parent = user?.role !== "CHILD";
  const [balances, setBalances] = useState<ChildBalance[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ChoreTransaction[]>([]);
  const [type, setType] = useState<Exclude<ChoreTransactionType, "CHORE_APPROVAL">>("PAYMENT");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await apiClient.listChildBalances();
      setBalances(rows);
      const childId = selectedChildId ?? rows[0]?.child_id ?? null;
      setSelectedChildId(childId);
      setTransactions(childId === null ? [] : await apiClient.listChoreTransactions(childId));
      setError(null);
    } catch (caught) { setError(formatApiError(caught)); }
  }, [selectedChildId]);

  useEffect(() => { void load(); }, [load]);

  async function selectChild(childId: number) {
    setSelectedChildId(childId);
    try { setTransactions(await apiClient.listChoreTransactions(childId)); } catch (caught) { setError(formatApiError(caught)); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedChildId === null) return;
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents === 0 || (type !== "ADJUSTMENT" && cents < 0)) { setError(type === "ADJUSTMENT" ? "Enter a non-zero adjustment." : "Enter an amount greater than zero."); return; }
    setSaving(true);
    try {
      await apiClient.createChoreTransaction({ child_id: selectedChildId, amount_cents: cents, type, memo });
      setAmount(""); setMemo(""); await load();
    } catch (caught) { setError(formatApiError(caught)); } finally { setSaving(false); }
  }

  return <section className="dashboard-grid" aria-label="Chore money">
    <div className="dashboard-section-header"><p className="eyebrow">Allowance ledger</p><h1>Money & History</h1><p>Child rewards increase the amount owed. Payments reduce it.</p></div>
    {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
    <Card className="dashboard-panel"><div className="panel-header-row"><h2>Amount Owed</h2></div>
      <ul className="balance-list" aria-label="Child balances">{balances.map((row) => <li className="balance-item" key={row.child_id}><div><p className="balance-name">{row.child_name}</p><p className="balance-meta">Current unpaid allowance</p></div><Button type="button" onClick={() => void selectChild(row.child_id)}>{money(row.balance_cents)}</Button></li>)}</ul>
    </Card>
    {parent && selectedChildId !== null ? <Card className="dashboard-panel"><h2>Record Activity</h2><form className="children-form" onSubmit={(event) => void submit(event)}>
      <FormField label="Type"><select className="text-input" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="PAYMENT">Payment made</option><option value="BONUS">Bonus</option><option value="ADJUSTMENT">Adjustment</option></select></FormField>
      <FormField label="Amount ($)"><TextInput type="number" min={type === "ADJUSTMENT" ? undefined : "0.01"} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></FormField>
      <FormField label="Note"><TextInput value={memo} maxLength={500} onChange={(event) => setMemo(event.target.value)} /></FormField>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record"}</Button>
    </form></Card> : null}
    <Card className="dashboard-panel"><h2>Ledger History</h2>{transactions.length === 0 ? <p>No transactions yet.</p> : <ul className="balance-list" aria-label="Ledger history">{transactions.map((row) => <li className="balance-item" key={row.id}><div><p className="balance-name">{row.type.replaceAll("_", " ")}</p><p className="balance-meta">{new Date(row.created_at).toLocaleDateString()}{row.memo ? ` · ${row.memo}` : ""}</p></div><span className="balance-pill">{money(row.amount_cents)}</span></li>)}</ul>}</Card>
  </section>;
}
