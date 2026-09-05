import type { ChoreTransactionActionType } from "@family-manager/family-api/finance";
import type { FormEvent, ReactElement } from "react";

import { Button, Card, FormField, TextInput } from "../../../ui";
import type { UseChoreFinanceResult } from "../hooks/useChoreFinance";

type FinanceActivityPanelProps = {
  finance: UseChoreFinanceResult;
};

export function FinanceActivityPanel({
  finance,
}: FinanceActivityPanelProps): ReactElement {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void finance.submit();
  }

  return (
    <Card className="dashboard-panel">
      <h2>Record Activity</h2>
      <form className="children-form" onSubmit={handleSubmit}>
        <FormField label="Type">
          <select
            className="text-input"
            value={finance.type}
            onChange={(event) =>
              finance.setType(event.target.value as ChoreTransactionActionType)
            }
          >
            <option value="PAYMENT">Payment made</option>
            <option value="BONUS">Bonus</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </FormField>
        <FormField label="Amount ($)">
          <TextInput
            type="number"
            min={finance.type === "ADJUSTMENT" ? undefined : "0.01"}
            step="0.01"
            value={finance.amount}
            onChange={(event) => finance.setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Note">
          <TextInput
            value={finance.memo}
            maxLength={500}
            onChange={(event) => finance.setMemo(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={finance.saving}>
          {finance.saving ? "Saving..." : "Record"}
        </Button>
      </form>
    </Card>
  );
}
