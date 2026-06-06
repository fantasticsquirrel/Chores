import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { styles } from "../../styles/layout";
import { formatError, formatNullableCount } from "../../utils/format";

export function ParentHomeScreen({
  modules,
  onModulesLoaded,
  session,
}: {
  modules: FamilyModule[];
  onModulesLoaded: (modules: FamilyModule[]) => void;
  session: AuthSessionResponse;
}) {
  const [activeChildrenCount, setActiveChildrenCount] = useState<number | null>(
    null,
  );
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [children, submissions, moduleResponse] = await Promise.all([
        apiClient.listChildren({
          household_id: session.user.household_id,
          active_only: true,
        }),
        apiClient.listSubmissions({ status: "PENDING" }),
        apiClient.getMyModules(),
      ]);
      setActiveChildrenCount(children.length);
      setPendingCount(submissions.length);
      onModulesLoaded(moduleResponse.modules);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, [onModulesLoaded, session.user.household_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View>
      <ScreenHeader
        subtitle="Household snapshot"
        title="Home"
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
      <View style={styles.statGrid}>
        <StatCard
          label="Active children"
          value={formatNullableCount(activeChildrenCount)}
        />
        <StatCard
          label="Pending reviews"
          value={formatNullableCount(pendingCount)}
        />
      </View>
      <SectionCard title="Enabled modules">
        {modules.length === 0 ? (
          <Text style={styles.mutedText}>No modules loaded yet.</Text>
        ) : (
          <View style={styles.chipRow}>
            {modules.map((module) => (
              <View key={module.key} style={styles.moduleChip}>
                <Text style={styles.moduleChipText}>{module.name}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </View>
  );
}
