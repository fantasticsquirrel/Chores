import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import { apiClient, ApiClientError, type Child } from "../api";
import { Badge, ButtonLink, Card, InlineNotice } from "../ui";

type DashboardState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

const DEFAULT_HOUSEHOLD_ID = 1;
const pendingSubmissionsCount = 0;

function formatLoadError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

export function ParentDashboardPage(): ReactElement {
  const [state, setState] = useState<DashboardState>({
    children: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    apiClient
      .listChildren({ household_id: DEFAULT_HOUSEHOLD_ID })
      .then((children) => {
        if (!isMounted) {
          return;
        }

        setState({ children, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({ children: [], loading: false, error: formatLoadError(error) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeChildrenCount = useMemo(
    () => state.children.filter((child) => child.active).length,
    [state.children],
  );

  return (
    <section className="dashboard-grid" aria-label="Parent dashboard">
      <Card className="metric-card">
        <p className="metric-label">Pending Submissions</p>
        <p className="metric-value">{pendingSubmissionsCount}</p>
        <p className="metric-footnote">Review approvals on the Board page.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Active Children</p>
        <p className="metric-value">{state.loading ? "-" : activeChildrenCount}</p>
        <p className="metric-footnote">Loaded from household {DEFAULT_HOUSEHOLD_ID}.</p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Parent Dashboard</h1>
          <Badge>Child Balances</Badge>
        </div>

        {state.loading ? <p>Loading child balances...</p> : null}

        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load children: {state.error}</InlineNotice>
        ) : null}

        {!state.loading && state.error === null && state.children.length === 0 ? (
          <p>No children found yet for this household.</p>
        ) : null}

        {!state.loading && state.error === null && state.children.length > 0 ? (
          <ul className="balance-list" aria-label="Child balances">
            {state.children.map((child) => (
              <li key={child.id} className="balance-item">
                <div>
                  <p className="balance-name">{child.name}</p>
                  <p className="balance-meta">{child.active ? "Active" : "Inactive"}</p>
                </div>
                <div className="balance-pill">Balance pending ledger API</div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Quick Actions</h2>
        </div>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">
            Manage Children
          </ButtonLink>
          <ButtonLink to="/board">
            Open Board
          </ButtonLink>
          <ButtonLink to="/parent/reports">
            View Reports
          </ButtonLink>
        </div>
      </Card>
    </section>
  );
}
