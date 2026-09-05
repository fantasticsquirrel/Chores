import { View } from "react-native";

import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  BalanceSelectionPanel,
  FinancialActionPanel,
  TransactionHistoryPanel,
} from "../../features/finance/components/FinancePanels";
import { useChoreFinance } from "../../features/finance/hooks/useChoreFinance";

export function MoneyScreen({ readOnly = false }: { readOnly?: boolean }) {
  const finance = useChoreFinance();

  return (
    <View>
      <ScreenHeader title="Money & History" subtitle="Allowance ledger" />
      {finance.error ? (
        <InlineNotice tone="error" message={finance.error} />
      ) : null}
      <BalanceSelectionPanel finance={finance} />
      {!readOnly ? <FinancialActionPanel finance={finance} /> : null}
      <TransactionHistoryPanel finance={finance} />
    </View>
  );
}
