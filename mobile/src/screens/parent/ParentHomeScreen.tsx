import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type {
  AuthSessionResponse,
  Child,
  FamilyModule,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { hasMobileDashboardCard } from "../../modules/registry";
import type { AppTab } from "../../navigation/types";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { todayDateString } from "../../utils/date";
import { formatCents, formatError, isParentRole } from "../../utils/format";

type Resource<T> = { data: T | null; loading: boolean; error: string | null };
const pending = <T,>(): Resource<T> => ({
  data: null,
  loading: true,
  error: null,
});
type Snapshot = {
  children: Resource<Child[]>;
  pending: Resource<number>;
  owed: Resource<number>;
  counts: Record<number, Resource<number>>;
};
const emptySnapshot = (): Snapshot => ({
  children: pending(),
  pending: pending(),
  owed: pending(),
  counts: {},
});
type RetryKey = "children" | "pending" | "owed" | `child:${number}`;

export function ParentHomeScreen({
  modules,
  onModulesLoaded,
  onNavigate,
  session,
}: {
  modules: FamilyModule[];
  onModulesLoaded: (modules: FamilyModule[]) => void;
  onNavigate?: (
    tab: AppTab,
    context?: { childId?: number; date?: string },
  ) => void;
  session: AuthSessionResponse;
}) {
  const scope = `${session.user.id}:${session.user.household_id}:${session.user.role}`;
  const [date, setDate] = useState(todayDateString);
  const [showAll, setShowAll] = useState(false);
  const [authority, setAuthority] = useState<{
    scope: string;
    modules: FamilyModule[];
  } | null>(null);
  const [result, setResult] = useState<{
    scope: string;
    snapshot: Snapshot;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [treeCount, setTreeCount] = useState<{
    scope: string;
    count: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const treeRequest = useRef<AbortController | null>(null);
  const retries = useRef<Partial<Record<RetryKey, () => Promise<void>>>>({});
  const publish = useRef(onModulesLoaded);
  publish.current = onModulesLoaded;
  const effectiveModules =
    authority?.scope === scope ? authority.modules : modules;
  const snapshot = result?.scope === scope ? result.snapshot : null;
  const parent = isParentRole(session.user.role);
  const choresModule = effectiveModules.find(
    (module) => module.key === "chores",
  );
  const choresEnabled =
    parent && hasMobileDashboardCard("chores") && choresModule !== undefined;

  const refresh = useCallback(async () => {
    const requestedDate = todayDateString();
    setDate(requestedDate);
    treeRequest.current?.abort();
    treeRequest.current = null;
    const request = ++generation.current;
    const authentication = apiClient.authenticationGeneration;
    const current = () =>
      generation.current === request &&
      authentication === apiClient.authenticationGeneration;
    retries.current = {};
    setTreeCount(null);
    setResult(null);
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getMyModules();
      if (!current()) return;
      setAuthority({ scope, modules: response.modules });
      publish.current(response.modules);
      // The optional tree shortcut must not block the daily action queue.
      if (
        isParentRole(session.user.role) &&
        hasMobileDashboardCard("family-tree") &&
        response.modules.some((module) => module.key === "family-tree")
      ) {
        const controller = new AbortController();
        treeRequest.current = controller;
        void (async () => {
          try {
            const tree = await (Reflect.apply(
              apiClient.getFamilyTreeCollection,
              apiClient,
              [{ signal: controller.signal }],
            ) as ReturnType<typeof apiClient.getFamilyTreeCollection>);
            if (current())
              setTreeCount({ scope, count: tree.active_people_count });
          } catch (treeError) {
            if (!current()) return;
            setError(formatError(treeError));
            if (
              typeof treeError === "object" &&
              treeError &&
              "status" in treeError &&
              [401, 403].includes(Number(treeError.status))
            ) {
              const revoked = response.modules.filter(
                (module) => module.key !== "family-tree",
              );
              setAuthority({ scope, modules: revoked });
              publish.current(revoked);
            }
          } finally {
            if (treeRequest.current === controller) treeRequest.current = null;
          }
        })();
      }
      if (
        !isParentRole(session.user.role) ||
        !hasMobileDashboardCard("chores") ||
        !response.modules.some((module) => module.key === "chores")
      )
        return;
      setResult({ scope, snapshot: emptySnapshot() });
      function update(change: (old: Snapshot) => Snapshot) {
        if (!current()) return;
        setResult((old) => ({
          scope,
          snapshot: change(
            old?.scope === scope ? old.snapshot : emptySnapshot(),
          ),
        }));
      }
      function section<T>(
        key: RetryKey,
        read: () => Promise<T>,
        write: (old: Snapshot, value: Resource<T>) => Snapshot,
        after?: (data: T) => void,
      ) {
        let latest = 0;
        const load = async () => {
          if (!current()) return;
          const version = ++latest;
          update((old) => write(old, pending<T>()));
          try {
            const data = await read();
            if (!current() || latest !== version) return;
            update((old) => write(old, { data, loading: false, error: null }));
            after?.(data);
          } catch (caught) {
            if (current() && latest === version)
              update((old) =>
                write(old, {
                  data: null,
                  loading: false,
                  error: formatError(caught),
                }),
              );
          }
        };
        retries.current[key] = load;
        void load();
      }
      section(
        "children",
        () =>
          apiClient
            .listChildren({
              household_id: session.user.household_id,
              active_only: true,
            })
            .then((rows) => rows.filter((child) => child.active)),
        (old, value) => ({ ...old, children: value }),
        (children) => {
          for (const child of children)
            section(
              `child:${child.id}`,
              () =>
                apiClient
                  .listEligibleChores({
                    date: requestedDate,
                    child_id: child.id,
                  })
                  .then((rows) => rows.length),
              (old, value) => ({
                ...old,
                counts: { ...old.counts, [child.id]: value },
              }),
            );
        },
      );
      section(
        "pending",
        () =>
          apiClient
            .listSubmissions({ status: "PENDING" })
            .then((rows) => rows.length),
        (old, value) => ({ ...old, pending: value }),
      );
      section(
        "owed",
        () =>
          apiClient
            .listChildBalances()
            .then((rows) =>
              rows.reduce((sum, row) => sum + row.balance_cents, 0),
            ),
        (old, value) => ({ ...old, owed: value }),
      );
    } catch (refreshError) {
      if (current()) setError(formatError(refreshError));
    } finally {
      if (current()) setLoading(false);
    }
  }, [scope, session.user.household_id, session.user.role]);

  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
      treeRequest.current?.abort();
      treeRequest.current = null;
      retries.current = {};
    };
  }, [refresh]);
  useEffect(
    () =>
      apiClient.subscribeAuthentication(() => {
        generation.current += 1;
        treeRequest.current?.abort();
        treeRequest.current = null;
        retries.current = {};
        setTreeCount(null);
        setAuthority(null);
        setResult(null);
        setLoading(false);
      }),
    [],
  );

  function action(
    label: string,
    tab: AppTab,
    context?: { childId?: number; date?: string },
  ) {
    return onNavigate ? (
      <ActionButton
        label={label}
        variant="secondary"
        onPress={() => (context ? onNavigate(tab, context) : onNavigate(tab))}
      />
    ) : null;
  }
  function retry(label: string, key: RetryKey) {
    return (
      <ActionButton
        label={label}
        variant="secondary"
        onPress={() => void retries.current[key]?.()}
      />
    );
  }
  const children = snapshot?.children.data ?? [];
  const caughtUp =
    snapshot?.pending.data === 0 &&
    snapshot.children.data !== null &&
    children.every((child) => snapshot.counts[child.id]?.data === 0);
  const value = (resource?: Resource<number>) =>
    resource?.data !== null && resource?.data !== undefined
      ? String(resource.data)
      : resource?.error
        ? "Unavailable"
        : "Loading...";

  return (
    <View>
      <ScreenHeader
        title="Home"
        subtitle="Today’s household actions"
        trailing={
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {choresEnabled ? (
        <>
          <SectionCard title="Today" subtitle="Action queue">
            {!snapshot || snapshot.pending.loading ? (
              <Text style={shellStyles.mutedText}>Loading approvals...</Text>
            ) : null}
            {snapshot?.pending.error ? (
              <>
                <InlineNotice
                  tone="error"
                  message={`Approvals unavailable: ${snapshot.pending.error}`}
                />
                {retry("Retry approvals", "pending")}
              </>
            ) : null}
            {snapshot?.pending.data && snapshot.pending.data > 0 ? (
              <View style={cardStyles.reviewItem}>
                <Text style={formStyles.rowTitle}>Chore approvals</Text>
                <Text style={shellStyles.mutedText}>
                  {snapshot.pending.data} pending{" "}
                  {snapshot.pending.data === 1 ? "submission" : "submissions"}
                </Text>
                {choresModule?.can_manage !== false
                  ? action(
                      `Review ${snapshot.pending.data} ${snapshot.pending.data === 1 ? "submission" : "submissions"}`,
                      "review",
                    )
                  : null}
              </View>
            ) : null}
            {snapshot?.children.loading ? (
              <Text style={shellStyles.mutedText}>Loading children...</Text>
            ) : null}
            {snapshot?.children.error ? (
              <>
                <InlineNotice
                  tone="error"
                  message={`Could not load children: ${snapshot.children.error}`}
                />
                {retry("Retry children", "children")}
              </>
            ) : null}
            {caughtUp ? (
              <Text
                accessibilityLiveRegion="polite"
                style={shellStyles.mutedText}
              >
                All caught up. No chores or approvals need attention today.
              </Text>
            ) : null}
            {snapshot?.children.data?.length === 0 ? (
              <Text style={shellStyles.mutedText}>
                No children yet. Add a child in Children.
              </Text>
            ) : null}
            {children.map((child) => {
              const count = snapshot?.counts[child.id] ?? pending<number>();
              if (count.data === 0 && !showAll) return null;
              return (
                <View key={child.id} style={cardStyles.reviewItem}>
                  <Text style={formStyles.rowTitle}>
                    {child.name} ·{" "}
                    {count.error
                      ? "chores unavailable"
                      : count.loading
                        ? "loading chores..."
                        : `${count.data} ${count.data === 1 ? "chore" : "chores"} due`}
                  </Text>
                  {count.error ? (
                    <>
                      <InlineNotice tone="error" message={count.error} />
                      {retry(
                        `Retry ${child.name}’s chores`,
                        `child:${child.id}`,
                      )}
                    </>
                  ) : null}
                  {action(`Open ${child.name}’s chores`, "chores", {
                    childId: child.id,
                    date,
                  })}
                </View>
              );
            })}
            {children.length > 0 ? (
              <ActionButton
                variant="secondary"
                label={
                  showAll
                    ? "Show due work only"
                    : `Show all ${children.length} ${children.length === 1 ? "child" : "children"}`
                }
                onPress={() => setShowAll(!showAll)}
              />
            ) : null}
          </SectionCard>
          <SectionCard title="Household summary">
            <View style={shellStyles.splitRow}>
              <Text>Active children</Text>
              <Text>
                {snapshot?.children.data
                  ? children.length
                  : snapshot?.children.error
                    ? "Unavailable"
                    : "Loading..."}
              </Text>
            </View>
            <View style={shellStyles.splitRow}>
              <Text>Pending reviews</Text>
              <Text>{value(snapshot?.pending)}</Text>
            </View>
            <View style={shellStyles.splitRow}>
              <Text>Total amount owed</Text>
              <Text>
                {snapshot?.owed.data !== null &&
                snapshot?.owed.data !== undefined
                  ? formatCents(snapshot.owed.data)
                  : value(snapshot?.owed)}
              </Text>
            </View>
            {snapshot?.owed.error ? (
              <>
                <InlineNotice
                  tone="error"
                  message={`Balances unavailable: ${snapshot.owed.error}`}
                />
                {retry("Retry balances", "owed")}
              </>
            ) : null}
          </SectionCard>
        </>
      ) : null}
      {parent && onNavigate ? (
        <SectionCard title="Quick Actions">
          <View style={formStyles.inlineButtons}>
            {choresEnabled ? (
              <>
                {action(
                  choresModule?.can_manage === false
                    ? "View Children"
                    : "Manage Children",
                  "children",
                )}
                {action("Open Review", "review")}
                {action("Money & History", "money")}
              </>
            ) : null}
            {effectiveModules.some((module) => module.key === "homeschool")
              ? action("Open Homeschool", "homeschool")
              : null}
            {authority?.scope === scope &&
            treeCount?.scope === scope &&
            effectiveModules.some((module) => module.key === "family-tree") &&
            hasMobileDashboardCard("family-tree")
              ? action(
                  treeCount.count === 0
                    ? "Start your family tree"
                    : "Open family tree",
                  "family-tree",
                )
              : null}
            {effectiveModules.some((module) => module.key === "recipes")
              ? action("Open Cookbook", "recipes")
              : null}
          </View>
        </SectionCard>
      ) : null}
      <SectionCard title="Enabled modules">
        {effectiveModules.length === 0 ? (
          <Text style={shellStyles.mutedText}>No modules loaded yet.</Text>
        ) : (
          <View style={cardStyles.chipRow}>
            {effectiveModules.map((module) => (
              <View key={module.key} style={cardStyles.moduleChip}>
                <Text style={cardStyles.moduleChipText}>{module.name}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </View>
  );
}
