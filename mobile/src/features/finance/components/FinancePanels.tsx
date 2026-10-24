import { parseChoreTransactionDraft } from "@family-manager/family-api/finance";
import { InlineNotice } from "../../../components/InlineNotice";
import { Pressable, Text, TextInput, View } from "react-native";

import { ActionButton } from "../../../components/ActionButton";
import { ChoiceGroup } from "../../../components/ChoiceGroup";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type {
  ChoreTransactionActionType,
  UseChoreFinanceResult,
} from "../hooks/useChoreFinance";

const transactionOptions: {
  label: string;
  value: ChoreTransactionActionType;
}[] = [
  { label: "Payment", value: "PAYMENT" },
  { label: "Bonus", value: "BONUS" },
  { label: "Adjustment", value: "ADJUSTMENT" },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function BalanceSelectionPanel({
  finance,
}: {
  finance: UseChoreFinanceResult;
}) {
  return (
    <SectionCard title="Amount Owed">
      {finance.balancesLoading ? <Text>Loading balances...</Text> : null}
      {finance.balancesError ? (
        <>
          <InlineNotice
            tone="error"
            message={`Could not refresh balances: ${finance.balancesError}`}
          />
          <ActionButton label="Retry balances" onPress={finance.loadBalances} />
        </>
      ) : null}
      {!finance.balancesLoading &&
      !finance.balancesError &&
      finance.balances.length === 0 ? (
        <Text>No child balances yet.</Text>
      ) : null}
      {finance.balances.map((row) => (
        <Pressable
          key={row.child_id}
          onPress={() => finance.selectChild(row.child_id)}
          accessibilityRole="button"
          accessibilityState={{
            selected: finance.childId === row.child_id,
            disabled: finance.saving,
          }}
          accessibilityLabel={`${row.child_name}, ${money(row.balance_cents)}${finance.childId === row.child_id ? ", selected" : ""}`}
          disabled={finance.saving}
          style={[
            formStyles.selectableRow,
            finance.childId === row.child_id
              ? formStyles.selectableRowSelected
              : null,
          ]}
        >
          <Text style={formStyles.rowTitle}>{row.child_name}</Text>
          <Text style={formStyles.selectionMark}>
            {finance.childId === row.child_id ? "✓ Selected · " : ""}
            {money(row.balance_cents)}
          </Text>
        </Pressable>
      ))}
    </SectionCard>
  );
}

export function FinancialActionPanel({
  finance,
}: {
  finance: UseChoreFinanceResult;
}) {
  const child = finance.balances.find(
    (row) => row.child_id === finance.childId,
  );
  const parsed = parseChoreTransactionDraft({
    amount: finance.amount,
    childId: finance.childId ?? 0,
    memo: finance.memo,
    type: finance.type,
  });
  const delta = parsed.payload
    ? parsed.payload.amount_cents * (finance.type === "PAYMENT" ? -1 : 1)
    : null;
  if (!child) return null;
  return (
    <SectionCard
      title={`Record ${finance.type.toLowerCase()} for ${child.child_name}`}
    >
      <Text style={shellStyles.mutedText}>
        This records allowance activity only. It does not transfer money.
      </Text>
      {delta !== null ? (
        <Text accessibilityLiveRegion="polite" style={formStyles.rowMeta}>
          Amount owed: {money(child.balance_cents)} →{" "}
          {money(child.balance_cents + delta)} after this{" "}
          {finance.type.toLowerCase()}.
        </Text>
      ) : null}
      <ChoiceGroup
        disabled={finance.saving}
        options={transactionOptions}
        value={finance.type}
        onChange={finance.setType}
      />
      {finance.type === "ADJUSTMENT" ? (
        <Text style={shellStyles.mutedText}>
          Use a positive amount to increase what is owed, or a negative amount
          to reduce it.
        </Text>
      ) : null}
      <FieldLabel label="Amount ($)" />
      <TextInput
        keyboardType={
          finance.type === "ADJUSTMENT"
            ? "numbers-and-punctuation"
            : "decimal-pad"
        }
        style={formStyles.input}
        accessibilityLabel="Amount ($)"
        editable={!finance.saving}
        value={finance.amount}
        onChangeText={finance.setAmount}
      />
      <FieldLabel label="Note" />
      <TextInput
        style={formStyles.input}
        accessibilityLabel="Note"
        editable={!finance.saving}
        maxLength={500}
        value={finance.memo}
        onChangeText={finance.setMemo}
      />
      {finance.error ? (
        <InlineNotice tone="error" message={finance.error} />
      ) : null}
      <ActionButton
        label={finance.saving ? "Saving..." : "Record"}
        disabled={finance.saving}
        onPress={finance.save}
        requiresManage
      />
      {finance.success ? (
        <Text accessibilityLiveRegion="polite">{finance.success}</Text>
      ) : null}
    </SectionCard>
  );
}

export function TransactionHistoryPanel({
  finance,
}: {
  finance: UseChoreFinanceResult;
}) {
  const child = finance.balances.find(
    (row) => row.child_id === finance.childId,
  );
  return (
    <SectionCard
      title={child ? `${child.child_name}’s history` : "Ledger History"}
    >
      {finance.historyLoading ? <Text>Loading history...</Text> : null}
      {finance.historyError ? (
        <>
          <InlineNotice
            tone="error"
            message={`Could not refresh history: ${finance.historyError}`}
          />
          <ActionButton label="Retry history" onPress={finance.loadHistory} />
        </>
      ) : null}
      {!finance.historyLoading &&
      !finance.historyError &&
      finance.transactions.length === 0 ? (
        <Text style={shellStyles.mutedText}>No transactions yet.</Text>
      ) : (
        finance.transactions.map((row) => (
          <View key={row.id} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <View>
                <Text style={formStyles.rowTitle}>
                  {row.type.replaceAll("_", " ")}
                </Text>
                <Text style={formStyles.rowMeta}>
                  {row.memo || new Date(row.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={formStyles.selectionMark}>
                {money(row.amount_cents)}
              </Text>
            </View>
          </View>
        ))
      )}
    </SectionCard>
  );
}
