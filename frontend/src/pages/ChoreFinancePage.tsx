import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { FinanceActivityPanel } from "../features/finance/components/FinanceActivityPanel";
import { useChoreFinance } from "../features/finance/hooks/useChoreFinance";
import { Button, Card, InlineNotice } from "../ui";

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ChoreFinancePage(): ReactElement {
  const { user } = useAuth();
  const parent = user?.role !== "CHILD";
  const finance = useChoreFinance();

  const child = finance.balances.find(
    (row) => row.child_id === finance.selectedChildId,
  );

  return (
    <section className="dashboard-grid" aria-label="Chore money">
      <div className="dashboard-section-header">
        <p className="eyebrow">Allowance ledger</p>
        <h1>Money & History</h1>
        <p>Child rewards increase the amount owed. Payments reduce it.</p>
      </div>
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Amount Owed</h2>
        </div>
        {finance.balancesLoading ? <p>Loading balances...</p> : null}
        {finance.balancesError ? (
          <InlineNotice variant="error">
            Could not refresh balances: {finance.balancesError}{" "}
            <Button onClick={() => void finance.loadBalances()}>
              Retry balances
            </Button>
          </InlineNotice>
        ) : null}
        {!finance.balancesLoading &&
        !finance.balancesError &&
        finance.balances.length === 0 ? (
          <p>No child balances yet.</p>
        ) : null}
        <ul className="balance-list" aria-label="Child balances">
          {finance.balances.map((row) => (
            <li
              className="balance-item"
              key={row.child_id}
              style={
                finance.selectedChildId === row.child_id
                  ? {
                      background: "var(--surface-soft)",
                      borderRadius: "var(--radius-button)",
                      padding: "0.75rem",
                    }
                  : undefined
              }
            >
              <div>
                <p className="balance-name">{row.child_name}</p>
                <p className="balance-meta">Current unpaid allowance</p>
              </div>
              <Button
                type="button"
                aria-pressed={finance.selectedChildId === row.child_id}
                aria-label={`${row.child_name}, ${money(row.balance_cents)}${finance.selectedChildId === row.child_id ? ", selected" : ""}`}
                disabled={finance.saving}
                onClick={() => void finance.selectChild(row.child_id)}
              >
                {finance.selectedChildId === row.child_id
                  ? "✓ Selected · "
                  : ""}
                {money(row.balance_cents)}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      {parent && finance.selectedChildId !== null ? (
        <FinanceActivityPanel finance={finance} />
      ) : null}
      <Card className="dashboard-panel">
        <h2>{child ? `${child.child_name}’s history` : "Ledger History"}</h2>
        {finance.historyLoading ? <p>Loading history...</p> : null}
        {finance.historyError ? (
          <InlineNotice variant="error">
            Could not refresh history: {finance.historyError}{" "}
            <Button onClick={() => void finance.loadHistory()}>
              Retry history
            </Button>
          </InlineNotice>
        ) : null}
        {!finance.historyLoading &&
        !finance.historyError &&
        finance.transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul className="balance-list" aria-label="Ledger history">
            {finance.transactions.map((row) => (
              <li className="balance-item" key={row.id}>
                <div>
                  <p className="balance-name">{row.type.replace(/_/g, " ")}</p>
                  <p className="balance-meta">
                    {new Date(row.created_at).toLocaleDateString()}
                    {row.memo ? ` · ${row.memo}` : ""}
                  </p>
                </div>
                <span className="balance-pill">{money(row.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
