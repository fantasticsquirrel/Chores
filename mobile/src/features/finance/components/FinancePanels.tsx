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
      {finance.balances.map((row) => (
        <Pressable
          key={row.child_id}
          onPress={() => finance.selectChild(row.child_id)}
          style={formStyles.selectableRow}
        >
          <Text style={formStyles.rowTitle}>{row.child_name}</Text>
          <Text style={formStyles.selectionMark}>
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
  return (
    <SectionCard title="Record Activity">
      <ChoiceGroup
        options={transactionOptions}
        value={finance.type}
        onChange={finance.setType}
      />
      <FieldLabel label="Amount ($)" />
      <TextInput
        keyboardType="decimal-pad"
        style={formStyles.input}
        value={finance.amount}
        onChangeText={finance.setAmount}
      />
      <FieldLabel label="Note" />
      <TextInput
        style={formStyles.input}
        value={finance.memo}
        onChangeText={finance.setMemo}
      />
      <ActionButton label="Record" onPress={finance.save} />
    </SectionCard>
  );
}

export function TransactionHistoryPanel({
  finance,
}: {
  finance: UseChoreFinanceResult;
}) {
  return (
    <SectionCard title="Ledger History">
      {finance.transactions.length === 0 ? (
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
