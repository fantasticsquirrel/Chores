import { colors } from "../../styles/colors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type { EligibleChore } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { useModuleAccess } from "../../modules/ModuleAccessContext";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { todayDateString } from "../../utils/date";
import { formatError } from "../../utils/format";

export function ChildTodayScreen() {
  const { canManageRef } = useModuleAccess();
  const initialDate = useMemo(() => todayDateString(), []);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const submitLock = useRef(false);
  const dateRef = useRef(initialDate);
  const [date, setDate] = useState(initialDate);
  const [chores, setChores] = useState<EligibleChore[]>([]);
  const [selectedChoreIds, setSelectedChoreIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async (nextDate: string, afterSave = false) => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    if (!afterSave) setSuccess(null);
    try {
      const eligible = await apiClient.listEligibleChores({ date: nextDate });
      if (request !== requestId.current || nextDate !== dateRef.current) return;
      setChores(eligible);
      setSelectedChoreIds(new Set());
    } catch (refreshError) {
      if (request !== requestId.current || nextDate !== dateRef.current) return;
      setError(`${afterSave ? "Submitted, but chores could not refresh. Try Refresh. " : ""}${formatError(refreshError)}`);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh(initialDate);
    const requests = requestId;
    return () => { mounted.current = false; requests.current += 1; };
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
    if (!canManageRef.current || submitLock.current || selectedChoreIds.size === 0 || loading) return;
    submitLock.current = true;
    const submittedDate = date;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.createSubmission({
        for_date: date,
        chore_ids: Array.from(selectedChoreIds),
      });
      if (mounted.current && submittedDate === dateRef.current) {
        setSelectedChoreIds(new Set());
        setChores((current) => current.filter((chore) => !selectedChoreIds.has(chore.chore_id)));
        setSuccess("Submitted for parent review.");
        await refresh(submittedDate, true);
      }
    } catch (submitError) {
      if (mounted.current && submittedDate === dateRef.current) setError(formatError(submitError));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function setToday() {
    const nextDate = todayDateString();
    dateRef.current = nextDate;
    setDate(nextDate);
    void refresh(nextDate);
  }

  return (
    <View>
      <ScreenHeader subtitle="Choose finished chores" title="Today" />
      <SectionCard title="Date">
        <TextInput
          autoCapitalize="none"
          editable={!submitting}
          onChangeText={(value) => {
            dateRef.current = value;
            requestId.current++;
            setChores([]);
            setSelectedChoreIds(new Set());
            setLoading(false);
            setDate(value);
            setSuccess(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSubtle}
          style={formStyles.input}
          value={date}
        />
        <View style={formStyles.inlineButtons}>
          <ActionButton
            compact
            disabled={loading || submitting}
            label="Today"
            onPress={setToday}
            variant="secondary"
          />
          <ActionButton
            compact
            disabled={loading || submitting}
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
          <Text style={shellStyles.mutedText}>{error ? "Chores are unavailable. Try Refresh." : "No chores are available for this date."}</Text>
        ) : (
          <View>
            {chores.map((chore) => (
              <Pressable
                key={chore.chore_id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedChoreIds.has(chore.chore_id), disabled: submitting }}
                disabled={submitting}
                onPress={() => toggleChore(chore.chore_id)}
                style={[
                  formStyles.selectableRow,
                  selectedChoreIds.has(chore.chore_id)
                    ? formStyles.selectableRowSelected
                    : null,
                ]}
              >
                <View style={formStyles.rowMain}>
                  <Text style={formStyles.rowTitle}>{chore.name}</Text>
                  {chore.expires_on ? <Text style={formStyles.rowMeta}>Expires {chore.expires_on}</Text> : null}
                </View>
                <Text
                  style={[
                    formStyles.selectionMark,
                    selectedChoreIds.has(chore.chore_id)
                      ? formStyles.selectionMarkSelected
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
        disabled={selectedChoreIds.size === 0 || submitting || loading}
        requiresManage
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
