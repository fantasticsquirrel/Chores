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

  return (
    <section className="dashboard-grid" aria-label="Chore money">
      <div className="dashboard-section-header">
        <p className="eyebrow">Allowance ledger</p>
        <h1>Money & History</h1>
        <p>Child rewards increase the amount owed. Payments reduce it.</p>
      </div>
      {finance.error ? (
        <InlineNotice variant="error">{finance.error}</InlineNotice>
      ) : null}
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Amount Owed</h2>
        </div>
        <ul className="balance-list" aria-label="Child balances">
          {finance.balances.map((row) => (
            <li className="balance-item" key={row.child_id}>
              <div>
                <p className="balance-name">{row.child_name}</p>
                <p className="balance-meta">Current unpaid allowance</p>
              </div>
              <Button
                type="button"
                onClick={() => void finance.selectChild(row.child_id)}
              >
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
        <h2>Ledger History</h2>
        {finance.transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul className="balance-list" aria-label="Ledger history">
            {finance.transactions.map((row) => (
              <li className="balance-item" key={row.id}>
                <div>
                  <p className="balance-name">
                    {row.type.replaceAll("_", " ")}
                  </p>
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
