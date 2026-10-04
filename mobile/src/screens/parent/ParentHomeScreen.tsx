import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, Child, FamilyModule } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { hasMobileDashboardCard } from "../../modules/registry";
import type { AppTab } from "../../navigation/types";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { todayDateString } from "../../utils/date";
import { formatCents, formatError, formatNullableCount, isParentRole } from "../../utils/format";

type Snapshot = {
  children: Child[];
  pending: number;
  owed: number;
  counts: Record<number, number>;
};

export function ParentHomeScreen({ modules, onModulesLoaded, onNavigate, session }: {
  modules: FamilyModule[];
  onModulesLoaded: (modules: FamilyModule[]) => void;
  onNavigate?: (tab: AppTab) => void;
  session: AuthSessionResponse;
}) {
  const scope = `${session.user.id}:${session.user.household_id}:${session.user.role}`;
  const [authority, setAuthority] = useState<{ scope: string; modules: FamilyModule[] } | null>(null);
  const [result, setResult] = useState<{ scope: string; snapshot: Snapshot } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const publish = useRef(onModulesLoaded);
  publish.current = onModulesLoaded;
  const effectiveModules = authority?.scope === scope ? authority.modules : modules;
  const snapshot = result?.scope === scope ? result.snapshot : null;
  const parent = isParentRole(session.user.role);
  const choresModule = effectiveModules.find((module) => module.key === "chores");
  const choresEnabled = parent && hasMobileDashboardCard("chores") && choresModule !== undefined;

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const current = () => generation.current === request;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getMyModules();
      if (!current()) return;
      setAuthority({ scope, modules: response.modules });
      // Publish access changes even if a later snapshot request fails.
      publish.current(response.modules);
      if (!isParentRole(session.user.role) || !hasMobileDashboardCard("chores") || !response.modules.some((module) => module.key === "chores")) {
        setResult(null);
        return;
      }
      const [children, submissions, balances] = await Promise.all([
        apiClient.listChildren({ household_id: session.user.household_id, active_only: true }),
        apiClient.listSubmissions({ status: "PENDING" }),
        apiClient.listChildBalances(),
      ]);
      if (!current()) return;
      const active = children.filter((child) => child.active);
      const date = todayDateString();
      const rows = await Promise.all(active.map(async (child) => [child.id, (await apiClient.listEligibleChores({ date, child_id: child.id })).length] as const));
      if (!current()) return;
      setResult({ scope, snapshot: { children: active, pending: submissions.length, owed: balances.reduce((sum, row) => sum + row.balance_cents, 0), counts: Object.fromEntries(rows) } });
    } catch (refreshError) {
      if (current()) setError(formatError(refreshError));
    } finally {
      if (current()) setLoading(false);
    }
  }, [scope, session.user.household_id, session.user.role]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  function action(label: string, tab: AppTab) {
    return onNavigate ? <ActionButton label={label} variant="secondary" onPress={() => onNavigate(tab)} /> : null;
  }

  return (
    <View>
      <ScreenHeader title="Home" subtitle="Household snapshot" trailing={<ActionButton compact disabled={loading} label={loading ? "Refreshing" : "Refresh"} onPress={refresh} variant="secondary" />} />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {choresEnabled ? <>
        <View style={cardStyles.statGrid}>
          <StatCard label="Active children" value={formatNullableCount(snapshot?.children.length ?? null)} />
          <StatCard label="Pending reviews" value={formatNullableCount(snapshot?.pending ?? null)} />
          <StatCard label="Total amount owed" value={snapshot ? formatCents(snapshot.owed) : "-"} />
        </View>
        <SectionCard title="Today" subtitle="Action queue">
          {loading ? <Text style={shellStyles.mutedText}>Building today's household queue...</Text> : null}
          {snapshot ? <>
            {snapshot.pending > 0 ? <View style={cardStyles.reviewItem}>
              <Text style={formStyles.rowTitle}>Chore approvals</Text>
              <Text style={shellStyles.mutedText}>{snapshot.pending} pending {snapshot.pending === 1 ? "submission" : "submissions"}</Text>
              {choresModule?.can_manage !== false ? action(`Review ${snapshot.pending} ${snapshot.pending === 1 ? "submission" : "submissions"}`, "review") : null}
            </View> : null}
            {snapshot.children.map((child) => <View key={child.id} style={cardStyles.reviewItem}>
              <Text style={formStyles.rowTitle}>{child.name} · {snapshot.counts[child.id]} {snapshot.counts[child.id] === 1 ? "chore" : "chores"} due</Text>
              <Text style={shellStyles.mutedText}>See assignments and help with anything blocked.</Text>
              {action("Open Chores", "chores")}
            </View>)}
            {snapshot.pending === 0 && snapshot.children.length === 0 ? <Text style={shellStyles.mutedText}>No household actions need attention.</Text> : null}
          </> : null}
        </SectionCard>
      </> : null}
      {parent && onNavigate ? <SectionCard title="Quick Actions"><View style={formStyles.inlineButtons}>
        {choresEnabled ? <>{action(choresModule?.can_manage === false ? "View Children" : "Manage Children", "children")}{action("Open Board", "review")}{action("Money & History", "money")}</> : null}
        {effectiveModules.some((module) => module.key === "homeschool") ? action("Open Homeschool", "homeschool") : null}
        {effectiveModules.some((module) => module.key === "recipes") ? action("Open Cookbook", "recipes") : null}
      </View></SectionCard> : null}
      <SectionCard title="Enabled modules">
        {effectiveModules.length === 0 ? <Text style={shellStyles.mutedText}>No modules loaded yet.</Text> : <View style={cardStyles.chipRow}>{effectiveModules.map((module) => <View key={module.key} style={cardStyles.moduleChip}><Text style={cardStyles.moduleChipText}>{module.name}</Text></View>)}</View>}
      </SectionCard>
    </View>
  );
}
