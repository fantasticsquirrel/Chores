import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

import { apiClient, type Child } from "../api";
import { useAuth } from "../auth/useAuth";
import { isTodayCaughtUp } from "../features/dashboard/lib/todayQueue";
import { FamilyTreeHomeShortcut } from "../features/family-tree/forms/FamilyTreeHomeShortcut";
import { formatApiError } from "../lib/errors";
import { hasWebDashboardCard } from "../modules/registry";
import { Badge, Button, ButtonLink, Card, InlineNotice } from "../ui";

type Resource<T> = { data: T | null; loading: boolean; error: string | null };
const pending = <T,>(): Resource<T> => ({
  data: null,
  loading: true,
  error: null,
});

// Each section owns its request and retry. A slow or failed section cannot erase
// successful neighbours, and the scope key prevents a previous account flashing.
function useDashboardResource<T>(scope: string | null, read: () => Promise<T>) {
  const [state, setState] = useState<{
    scope: string | null;
    value: Resource<T>;
  }>({ scope, value: pending<T>() });
  const request = useRef(0);
  const retry = useCallback(async () => {
    const generation = ++request.current;
    if (!scope) return;
    setState((old) => ({
      scope,
      value: {
        data: old.scope === scope ? old.value.data : null,
        loading: true,
        error: null,
      },
    }));
    try {
      const data = await read();
      if (request.current === generation)
        setState({ scope, value: { data, loading: false, error: null } });
    } catch (error) {
      if (request.current === generation)
        setState((old) => ({
          scope,
          value: { ...old.value, loading: false, error: formatApiError(error) },
        }));
    }
  }, [scope, read]);
  useEffect(() => {
    void retry();
    return () => {
      request.current += 1;
    };
  }, [retry]);
  return { ...(state.scope === scope ? state.value : pending<T>()), retry };
}

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ParentDashboardPage(): ReactElement {
  const { user, moduleKeys } = useAuth();
  const choresEnabled =
    hasWebDashboardCard("chores") && moduleKeys.includes("chores");
  const householdId = user?.household_id ?? null;
  const scope =
    choresEnabled && user ? `${user.id}:${householdId}:${user.role}` : null;
  const [date] = useState(localDate);
  const [showAll, setShowAll] = useState(false);
  const readChildren = useCallback(() => {
    if (householdId === null)
      return Promise.reject(new Error("Could not determine household scope."));
    return apiClient.listChildren({ household_id: householdId });
  }, [householdId]);
  const readApprovals = useCallback(
    () => apiClient.listSubmissions({ status: "PENDING" }),
    [],
  );
  const readBalances = useCallback(() => apiClient.listChildBalances(), []);
  const children = useDashboardResource(scope, readChildren);
  const approvals = useDashboardResource(scope, readApprovals);
  const balances = useDashboardResource(scope, readBalances);
  const [counts, setCounts] = useState<{
    scope: string | null;
    values: Record<number, Resource<number>>;
  }>({ scope, values: {} });
  const countGeneration = useRef(0);
  const countRequests = useRef<Record<number, number>>({});
  const loadChild = useCallback(
    async (child: Child) => {
      const generation = countGeneration.current;
      const request = (countRequests.current[child.id] ?? 0) + 1;
      countRequests.current[child.id] = request;
      setCounts((old) => ({
        scope,
        values: {
          ...(old.scope === scope ? old.values : {}),
          [child.id]: pending<number>(),
        },
      }));
      const current = () =>
        generation === countGeneration.current &&
        countRequests.current[child.id] === request;
      try {
        const rows = await apiClient.listEligibleChores({
          date,
          child_id: child.id,
        });
        if (current())
          setCounts((old) => ({
            scope,
            values: {
              ...old.values,
              [child.id]: { data: rows.length, loading: false, error: null },
            },
          }));
      } catch (error) {
        if (current())
          setCounts((old) => ({
            scope,
            values: {
              ...old.values,
              [child.id]: {
                data: null,
                loading: false,
                error: formatApiError(error),
              },
            },
          }));
      }
    },
    [date, scope],
  );
  useEffect(() => {
    countGeneration.current += 1;
    setCounts({ scope, values: {} });
    if (scope)
      for (const child of children.data ?? [])
        if (child.active) void loadChild(child);
    return () => {
      countGeneration.current += 1;
    };
  }, [scope, children.data, loadChild]);

  const active = children.data?.filter((child) => child.active) ?? [];
  const currentCounts = counts.scope === scope ? counts.values : {};
  const caughtUp = isTodayCaughtUp(approvals, children, currentCounts);
  const total = balances.data?.reduce((sum, row) => sum + row.balance_cents, 0);

  return (
    <section className="dashboard-grid" aria-label="Parent dashboard">
      {choresEnabled ? (
        <>
          <Card className="dashboard-panel">
            <div className="panel-header-row">
              <h1>Today</h1>
              <Badge>Action Queue</Badge>
            </div>
            {approvals.loading ? <p>Loading approvals...</p> : null}
            {approvals.error ? (
              <InlineNotice variant="error">
                Approvals unavailable: {approvals.error}{" "}
                <Button onClick={() => void approvals.retry()}>
                  Retry approvals
                </Button>
              </InlineNotice>
            ) : null}
            {approvals.data && approvals.data.length > 0 ? (
              <div className="balance-item">
                <div>
                  <p className="balance-name">Chore approvals</p>
                  <p className="balance-meta">
                    Completed work is waiting for review.
                  </p>
                </div>
                <ButtonLink to="/board">
                  Review {approvals.data.length}{" "}
                  {approvals.data.length === 1 ? "submission" : "submissions"}
                </ButtonLink>
              </div>
            ) : null}
            {children.loading ? <p>Loading children...</p> : null}
            {children.error ? (
              <InlineNotice variant="error">
                Could not load children: {children.error}{" "}
                <Button onClick={() => void children.retry()}>
                  Retry children
                </Button>
              </InlineNotice>
            ) : null}
            {caughtUp ? (
              <p role="status">
                All caught up. No chores or approvals need attention today.
              </p>
            ) : null}
            {children.data?.length === 0 && !children.error ? (
              <p>
                No children yet.{" "}
                <ButtonLink to="/parent/children">Add a child</ButtonLink>
              </p>
            ) : null}
            <ul className="balance-list" aria-label="Today actions">
              {active.map((child) => {
                const count = currentCounts[child.id] ?? pending<number>();
                if (count.data === 0 && !count.error && !showAll) return null;
                return (
                  <li className="balance-item" key={child.id}>
                    <div>
                      <p className="balance-name">
                        {child.name} ·{" "}
                        {count.error
                          ? "chores unavailable"
                          : count.loading
                            ? "loading chores..."
                            : `${count.data} ${count.data === 1 ? "chore" : "chores"} due`}
                      </p>
                      {count.error ? (
                        <InlineNotice variant="error">
                          {count.error}{" "}
                          <Button onClick={() => void loadChild(child)}>
                            Retry {child.name}’s chores
                          </Button>
                        </InlineNotice>
                      ) : null}
                    </div>
                    <ButtonLink
                      to={`/parent/chores?childId=${child.id}&date=${date}`}
                    >
                      Open {child.name}’s chores
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
            {active.length > 0 ? (
              <Button
                aria-pressed={showAll}
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "Show due work only"
                  : `Show all ${active.length} ${active.length === 1 ? "child" : "children"}`}
              </Button>
            ) : null}
          </Card>
          <Card className="dashboard-panel">
            <h2>Household summary</h2>
            <dl className="quick-actions">
              <div>
                <dt>Pending Submissions</dt>
                <dd>
                  {approvals.error && approvals.data === null
                    ? "Unavailable"
                    : (approvals.data?.length ?? "Loading...")}
                </dd>
              </div>
              <div>
                <dt>Total Amount Owed</dt>
                <dd>
                  {total !== undefined
                    ? `$${(total / 100).toFixed(2)}`
                    : balances.error
                      ? "Unavailable"
                      : "Loading..."}
                </dd>
              </div>
              <div>
                <dt>Active Children</dt>
                <dd>
                  {children.data
                    ? active.length
                    : children.error
                      ? "Unavailable"
                      : "Loading..."}
                </dd>
              </div>
            </dl>
            {balances.error ? (
              <InlineNotice variant="error">
                Balances unavailable: {balances.error}{" "}
                <Button onClick={() => void balances.retry()}>
                  Retry balances
                </Button>
              </InlineNotice>
            ) : null}
          </Card>
        </>
      ) : null}
      {(user?.role === "PARENT" || user?.role === "PARENT_ADMIN") &&
      moduleKeys.includes("family-tree") &&
      hasWebDashboardCard("family-tree") ? (
        <FamilyTreeHomeShortcut />
      ) : null}
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Quick Actions</h2>
        </div>
        <div className="quick-actions">
          {choresEnabled ? (
            <>
              <ButtonLink to="/parent/children">Manage Children</ButtonLink>
              <ButtonLink to="/board">Open Review</ButtonLink>
              <ButtonLink to="/parent/money">Money &amp; History</ButtonLink>
            </>
          ) : null}
          {hasWebDashboardCard("homeschool") &&
          moduleKeys.includes("homeschool") ? (
            <ButtonLink to="/homeschool">Open Homeschool</ButtonLink>
          ) : null}
          {hasWebDashboardCard("recipes") && moduleKeys.includes("recipes") ? (
            <ButtonLink to="/recipes">Open Cookbook</ButtonLink>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
