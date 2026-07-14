import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import { apiClient, type Child } from "../api";
import { useAuth } from "../auth/useAuth";
import { formatApiError } from "../lib/errors";
import { Badge, ButtonLink, Card, InlineNotice } from "../ui";

type DashboardState = {
  children: Child[];
  choreCountsByChild: Record<number, number>;
  pendingSubmissionsCount: number;
  loading: boolean;
  error: string | null;
};

export function ParentDashboardPage(): ReactElement {
  const { user, moduleKeys } = useAuth();
  const householdId = user?.household_id ?? null;
  const [state, setState] = useState<DashboardState>({
    children: [],
    choreCountsByChild: {},
    pendingSubmissionsCount: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    if (householdId === null) {
      setState({
        children: [],
        choreCountsByChild: {},
        pendingSubmissionsCount: 0,
        loading: false,
        error: "Could not determine household scope.",
      });
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listSubmissions({ status: "PENDING" }),
    ])
      .then(async ([children, submissions]) => {
        const today = new Date().toISOString().slice(0, 10);
        const choreRows = await Promise.all(
          children
            .filter((child) => child.active)
            .map(async (child) => [
              child.id,
              (await apiClient.listEligibleChores({ date: today, child_id: child.id })).length,
            ] as const),
        );
        if (!isMounted) {
          return;
        }

        setState({
          children,
          choreCountsByChild: Object.fromEntries(choreRows),
          pendingSubmissionsCount: submissions.length,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          children: [],
          choreCountsByChild: {},
          pendingSubmissionsCount: 0,
          loading: false,
          error: formatApiError(error),
        });
      });

    return () => {
      isMounted = false;
    };
  }, [householdId]);

  const activeChildrenCount = useMemo(
    () => state.children.filter((child) => child.active).length,
    [state.children],
  );

  return (
    <section className="dashboard-grid" aria-label="Parent dashboard">
      <Card className="metric-card">
        <p className="metric-label">Pending Submissions</p>
        <p className="metric-value">{state.loading ? "-" : state.pendingSubmissionsCount}</p>
        <p className="metric-footnote">Review approvals on the Board page.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Active Children</p>
        <p className="metric-value">{state.loading ? "-" : activeChildrenCount}</p>
        <p className="metric-footnote">Children with active profiles.</p>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Today</h1>
          <Badge>Action Queue</Badge>
        </div>

        {state.loading ? <p>Building today&apos;s household queue...</p> : null}

        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load children: {state.error}</InlineNotice>
        ) : null}

        {!state.loading && state.error === null ? (
          <ul className="balance-list" aria-label="Today actions">
            {state.pendingSubmissionsCount > 0 ? (
              <li className="balance-item">
                <div>
                  <p className="balance-name">Chore approvals</p>
                  <p className="balance-meta">Completed work is waiting for review.</p>
                </div>
                <ButtonLink to="/board">Review {state.pendingSubmissionsCount} {state.pendingSubmissionsCount === 1 ? "submission" : "submissions"}</ButtonLink>
              </li>
            ) : null}
            {state.children.filter((child) => child.active).map((child) => {
              const count = state.choreCountsByChild[child.id] ?? 0;
              return (
                <li key={child.id} className="balance-item">
                  <div>
                    <p className="balance-name">{child.name} · {count} {count === 1 ? "chore" : "chores"} due</p>
                    <p className="balance-meta">See assignments and help with anything blocked.</p>
                  </div>
                  <ButtonLink to="/parent/chores">Open Chores</ButtonLink>
                </li>
              );
            })}
            {state.pendingSubmissionsCount === 0 && activeChildrenCount === 0 ? <li>No household actions need attention.</li> : null}
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
          {moduleKeys.includes("homeschool") ? <ButtonLink to="/homeschool">Open Homeschool</ButtonLink> : null}
          {moduleKeys.includes("recipes") ? <ButtonLink to="/recipes">Open Cookbook</ButtonLink> : null}
        </div>
      </Card>
    </section>
  );
}
