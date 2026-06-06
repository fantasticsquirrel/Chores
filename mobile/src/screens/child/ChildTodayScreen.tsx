import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type { EligibleChore } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { todayDateString } from "../../utils/date";
import { formatCents, formatError } from "../../utils/format";

export function ChildTodayScreen() {
  const initialDate = useMemo(() => todayDateString(), []);
  const [date, setDate] = useState(initialDate);
  const [chores, setChores] = useState<EligibleChore[]>([]);
  const [selectedChoreIds, setSelectedChoreIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async (nextDate: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const eligible = await apiClient.listEligibleChores({ date: nextDate });
      setChores(eligible);
      setSelectedChoreIds(new Set());
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(initialDate);
  }, [initialDate, refresh]);

  function toggleChore(choreId: number) {
    setSelectedChoreIds((current) => {
      const next = new Set(current);
      if (next.has(choreId)) {
        next.delete(choreId);
      } else {
        next.add(choreId);
      }
      return next;
    });
    setSuccess(null);
  }

  async function submitSelected() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.createSubmission({
        for_date: date,
        chore_ids: Array.from(selectedChoreIds),
      });
      setSuccess("Submitted for parent review.");
      await refresh(date);
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function setToday() {
    const nextDate = todayDateString();
    setDate(nextDate);
    void refresh(nextDate);
  }

  return (
    <View>
      <ScreenHeader subtitle="Choose finished chores" title="Today" />
      <SectionCard title="Date">
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => {
            setDate(value);
            setSuccess(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={date}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={loading}
            label="Today"
            onPress={setToday}
            variant="secondary"
          />
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Loading" : "Refresh"}
            onPress={() => refresh(date)}
            variant="secondary"
          />
        </View>
      </SectionCard>
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {success !== null ? <InlineNotice tone="success" message={success} /> : null}
      <SectionCard title="Eligible chores">
        {loading ? (
          <LoadingRow label="Loading chores" />
        ) : chores.length === 0 ? (
          <Text style={styles.mutedText}>No chores are available for this date.</Text>
        ) : (
          <View>
            {chores.map((chore) => (
              <Pressable
                key={chore.chore_id}
                accessibilityRole="button"
                onPress={() => toggleChore(chore.chore_id)}
                style={[
                  styles.selectableRow,
                  selectedChoreIds.has(chore.chore_id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{chore.name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatCents(chore.reward_cents)}
                    {chore.expires_on ? ` · expires ${chore.expires_on}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.selectionMark,
                    selectedChoreIds.has(chore.chore_id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {selectedChoreIds.has(chore.chore_id) ? "Selected" : "Select"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </SectionCard>
      <ActionButton
        disabled={selectedChoreIds.size === 0 || submitting}
        label={
          submitting
            ? "Submitting..."
            : `Submit ${selectedChoreIds.size || ""}`.trim()
        }
        onPress={submitSelected}
      />
    </View>
  );
}
