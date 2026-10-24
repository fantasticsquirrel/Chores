import {
  parseChoreTransactionDraft,
  type ChoreTransactionActionType,
} from "@family-manager/family-api/finance";
import type { FormEvent, ReactElement } from "react";

import { Button, Card, FormField, InlineNotice, TextInput } from "../../../ui";
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

  const child = finance.balances.find(
    (row) => row.child_id === finance.selectedChildId,
  );
  const parsed = parseChoreTransactionDraft({
    amount: finance.amount,
    childId: finance.selectedChildId ?? 0,
    memo: finance.memo,
    type: finance.type,
  });
  const delta = parsed.payload
    ? parsed.payload.amount_cents * (finance.type === "PAYMENT" ? -1 : 1)
    : null;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  return (
    <Card className="dashboard-panel">
      <h2>
        Record {finance.type.toLowerCase()} for {child?.child_name}
      </h2>
      <p>This records allowance activity only. It does not transfer money.</p>
      {delta !== null && child ? (
        <p role="status">
          Amount owed: {money(child.balance_cents)} →{" "}
          {money(child.balance_cents + delta)} after this{" "}
          {finance.type.toLowerCase()}.
        </p>
      ) : null}
      <form className="children-form" onSubmit={handleSubmit}>
        <FormField label="Type">
          <select
            className="text-input"
            disabled={finance.saving}
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
        {finance.type === "ADJUSTMENT" ? (
          <p>
            Use a positive amount to increase what is owed, or a negative amount
            to reduce it.
          </p>
        ) : null}
        <FormField label="Amount ($)">
          <TextInput
            type="number"
            min={finance.type === "ADJUSTMENT" ? undefined : "0.01"}
            step="0.01"
            disabled={finance.saving}
            value={finance.amount}
            onChange={(event) => finance.setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Note">
          <TextInput
            disabled={finance.saving}
            value={finance.memo}
            maxLength={500}
            onChange={(event) => finance.setMemo(event.target.value)}
          />
        </FormField>
        {finance.error ? (
          <InlineNotice variant="error">{finance.error}</InlineNotice>
        ) : null}
        <Button type="submit" disabled={finance.saving}>
          {finance.saving ? "Saving..." : "Record"}
        </Button>
        {finance.success ? <p role="status">{finance.success}</p> : null}
      </form>
    </Card>
  );
}
