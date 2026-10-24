import { View } from "react-native";

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
      <BalanceSelectionPanel finance={finance} />
      {!readOnly ? <FinancialActionPanel finance={finance} /> : null}
      <TransactionHistoryPanel finance={finance} />
    </View>
  );
}
