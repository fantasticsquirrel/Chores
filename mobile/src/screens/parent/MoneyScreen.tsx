import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { apiClient } from "../../api/client";
import type { ChildBalance, ChoreTransaction } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function MoneyScreen({ readOnly = false }: { readOnly?: boolean }) {
  const [balances, setBalances] = useState<ChildBalance[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ChoreTransaction[]>([]);
  const [type, setType] = useState<"PAYMENT" | "BONUS" | "ADJUSTMENT">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(preferred: number | null = childId) {
    try {
      const rows = await apiClient.listChildBalances();
      const id = preferred ?? rows[0]?.child_id ?? null;
      setBalances(rows); setChildId(id);
      setTransactions(id === null ? [] : await apiClient.listChoreTransactions(id));
      setError(null);
    } catch (caught) { setError(formatError(caught)); }
  }
  useEffect(() => { void load(null); }, []);

  async function save() {
    if (childId === null) return;
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents === 0 || (type !== "ADJUSTMENT" && cents < 0)) { setError(type === "ADJUSTMENT" ? "Enter a non-zero adjustment." : "Enter an amount greater than zero."); return; }
    try {
      await apiClient.createChoreTransaction({ child_id: childId, amount_cents: cents, type, memo });
      setAmount(""); setMemo(""); await load(childId);
    } catch (caught) { setError(formatError(caught)); }
  }

  return <View><ScreenHeader title="Money & History" subtitle="Allowance ledger" />
    {error ? <InlineNotice tone="error" message={error} /> : null}
    <SectionCard title="Amount Owed">{balances.map((row) => <Pressable key={row.child_id} onPress={() => { setChildId(row.child_id); void load(row.child_id); }} style={styles.selectableRow}><Text style={styles.rowTitle}>{row.child_name}</Text><Text style={styles.selectionMark}>{money(row.balance_cents)}</Text></Pressable>)}</SectionCard>
    {!readOnly ? <SectionCard title="Record Activity"><ChoiceGroup options={[{label:"Payment",value:"PAYMENT"},{label:"Bonus",value:"BONUS"},{label:"Adjustment",value:"ADJUSTMENT"}]} value={type} onChange={(value) => setType(value as typeof type)} /><FieldLabel label="Amount ($)" /><TextInput keyboardType="decimal-pad" style={styles.input} value={amount} onChangeText={setAmount} /><FieldLabel label="Note" /><TextInput style={styles.input} value={memo} onChangeText={setMemo} /><ActionButton label="Record" onPress={save} /></SectionCard> : null}
    <SectionCard title="Ledger History">{transactions.length === 0 ? <Text style={styles.mutedText}>No transactions yet.</Text> : transactions.map((row) => <View key={row.id} style={styles.reviewItem}><View style={styles.splitRow}><View><Text style={styles.rowTitle}>{row.type.replaceAll("_", " ")}</Text><Text style={styles.rowMeta}>{row.memo || new Date(row.created_at).toLocaleDateString()}</Text></View><Text style={styles.selectionMark}>{money(row.amount_cents)}</Text></View></View>)}</SectionCard>
  </View>;
}
