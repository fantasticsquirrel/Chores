import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type {
  AuthSessionResponse,
  Child,
  Chore,
  EligibleChore,
  ScheduleUnit,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import {
  assignmentOptions,
  buildDefaultChoreForm,
  buildEditChoreForm,
  completionOptions,
  eligibilityLabel,
  type MobileChoreFormState,
  parseOptionalPositiveInteger,
  scheduleLabel,
  scheduleOptions,
  scheduleUnitOptions,
  timingLabel,
} from "../../features/chores/lib/chorePresentation";
import { styles } from "../../styles/layout";
import { todayDateString } from "../../utils/date";
import { formatError } from "../../utils/format";

type ChoresState = {
  chores: Chore[];
  loading: boolean;
  error: string | null;
};

type ChildrenState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

type EligibleChildState = {
  chores: EligibleChore[];
  loading: boolean;
  error: string | null;
  message: string | null;
  submittingChoreId: number | null;
};

const EMPTY_ELIGIBLE_STATE: EligibleChildState = {
  chores: [],
  loading: false,
  error: null,
  message: null,
  submittingChoreId: null,
};

export function ChoresScreen({ session }: { session: AuthSessionResponse }) {
  const householdId = session.user.household_id;
  const [targetDate, setTargetDate] = useState(todayDateString);
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [selectedChoreIds, setSelectedChoreIds] = useState<number[]>([]);
  const [selectedSubmitError, setSelectedSubmitError] = useState<string | null>(
    null,
  );
  const [selectedSubmitSuccess, setSelectedSubmitSuccess] = useState<
    string | null
  >(null);
  const [selectedSubmitting, setSelectedSubmitting] = useState(false);
  const [choresState, setChoresState] = useState<ChoresState>({
    chores: [],
    loading: true,
    error: null,
  });
  const [form, setForm] = useState<MobileChoreFormState>(() => buildDefaultChoreForm(todayDateString()));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const activeChildren = useMemo(
    () => childrenState.children.filter((child) => child.active),
    [childrenState.children],
  );
  const selectedChild =
    selectedChildId === null
      ? null
      : (activeChildren.find((child) => child.id === selectedChildId) ?? null);
  const selectedEligibleState =
    selectedChild !== null
      ? (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE)
      : EMPTY_ELIGIBLE_STATE;
  const showInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";

  const loadChores = useCallback(async () => {
    setChoresState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const chores = await apiClient.listChores({
        household_id: householdId,
        active_only: false,
      });
      setChoresState({ chores, loading: false, error: null });
    } catch (error) {
      setChoresState({ chores: [], loading: false, error: formatError(error) });
    }
  }, [householdId]);

  const refreshEligibleForChild = useCallback(
    async (childId: number, options: { preserveMessage?: boolean } = {}) => {
      setEligibleByChildId((previous) => ({
        ...previous,
        [childId]: {
          ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
          loading: true,
          error: null,
          message: options.preserveMessage
            ? (previous[childId]?.message ?? null)
            : null,
        },
      }));

      try {
        const chores = await apiClient.listEligibleChores({
          date: targetDate,
          child_id: childId,
        });
        setEligibleByChildId((previous) => ({
          ...previous,
          [childId]: {
            ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
            chores,
            loading: false,
            error: null,
            message: options.preserveMessage
              ? (previous[childId]?.message ?? null)
              : null,
            submittingChoreId: null,
          },
        }));
        setSelectedChoreIds((previous) =>
          previous.filter((choreId) =>
            chores.some((chore) => chore.chore_id === choreId),
          ),
        );
      } catch (error) {
        setEligibleByChildId((previous) => ({
          ...previous,
          [childId]: {
            ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
            chores: [],
            loading: false,
            error: formatError(error),
            message: null,
            submittingChoreId: null,
          },
        }));
        setSelectedChoreIds([]);
      }
    },
    [targetDate],
  );

  const loadChildrenAndEligible = useCallback(async () => {
    setChildrenState((previous) => ({ ...previous, loading: true, error: null }));
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
    setSelectedChoreIds([]);

    try {
      const children = await apiClient.listChildren({ household_id: householdId });
      const active = children.filter((child) => child.active);
      setChildrenState({ children, loading: false, error: null });
      setSelectedChildId((previous) =>
        previous !== null && active.some((child) => child.id === previous)
          ? previous
          : (active[0]?.id ?? null),
      );

      setEligibleByChildId(
        Object.fromEntries(
          active.map((child) => [
            child.id,
            { ...EMPTY_ELIGIBLE_STATE, loading: true },
          ]),
        ),
      );
      const results = await Promise.all(
        active.map(async (child) => {
          try {
            const chores = await apiClient.listEligibleChores({
              date: targetDate,
              child_id: child.id,
            });
            return [child.id, { ...EMPTY_ELIGIBLE_STATE, chores }] as const;
          } catch (error) {
            return [
              child.id,
              { ...EMPTY_ELIGIBLE_STATE, error: formatError(error) },
            ] as const;
          }
        }),
      );
      setEligibleByChildId(Object.fromEntries(results));
    } catch (error) {
      setChildrenState({
        children: [],
        loading: false,
        error: formatError(error),
      });
      setEligibleByChildId({});
    }
  }, [householdId, targetDate]);

  useEffect(() => {
    void loadChores();
  }, [loadChores]);

  useEffect(() => {
    void loadChildrenAndEligible();
  }, [loadChildrenAndEligible]);

  function setEligibleChildState(
    childId: number,
    patch: Partial<EligibleChildState>,
  ) {
    setEligibleByChildId((previous) => ({
      ...previous,
      [childId]: {
        ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
        ...patch,
      },
    }));
  }

  function handleDateChange(nextDate: string) {
    setTargetDate(nextDate);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function toggleSelectedChore(choreId: number) {
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }

  async function quickSubmit(child: Child, chore: EligibleChore) {
    setEligibleChildState(child.id, {
      submittingChoreId: chore.chore_id,
      error: null,
      message: null,
    });

    try {
      await apiClient.createSubmission(
        { for_date: targetDate, chore_ids: [chore.chore_id] },
        { child_id: child.id },
      );
      setEligibleChildState(child.id, {
        message: `Submitted ${chore.name} for review.`,
        submittingChoreId: null,
      });
      await refreshEligibleForChild(child.id, { preserveMessage: true });
    } catch (error) {
      setEligibleChildState(child.id, {
        error: formatError(error),
        submittingChoreId: null,
        message: null,
      });
    }
  }

  async function submitSelected() {
    if (selectedChild === null) {
      setSelectedSubmitError("Select a child first.");
      return;
    }
    if (selectedChoreIds.length === 0) {
      setSelectedSubmitError("Select at least one chore to submit.");
      return;
    }

    setSelectedSubmitting(true);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
    try {
      await apiClient.createSubmission(
        { for_date: targetDate, chore_ids: selectedChoreIds },
        { child_id: selectedChild.id },
      );
      setSelectedSubmitSuccess(
        `Submitted ${selectedChoreIds.length} chore(s) for ${selectedChild.name}.`,
      );
      setSelectedChoreIds([]);
      await refreshEligibleForChild(selectedChild.id);
    } catch (error) {
      setSelectedSubmitError(formatError(error));
    } finally {
      setSelectedSubmitting(false);
    }
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(buildDefaultChoreForm(todayDateString()));
    setSubmitError(null);
    setShowForm(true);
  }

  function openEditForm(chore: Chore) {
    setEditingId(chore.id);
    setForm(buildEditChoreForm(chore));
    setSubmitError(null);
    setShowForm(true);
  }

  function setField<K extends keyof MobileChoreFormState>(key: K, value: MobileChoreFormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitChoreForm() {
    const name = form.name.trim();
    if (name.length === 0) {
      setSubmitError("Chore name is required.");
      return;
    }

    let timeoutDays: number | null;
    let scheduleInterval: number | null;
    try {
      timeoutDays = parseOptionalPositiveInteger(form.timeout_days, "Timeout");
      const needsInterval = showInterval;
      scheduleInterval = needsInterval
        ? parseOptionalPositiveInteger(form.schedule_interval, "Interval")
        : null;
      if (needsInterval && scheduleInterval === null) {
        setSubmitError("Interval is required for repeating schedules.");
        return;
      }
    } catch (error) {
      setSubmitError(formatError(error));
      return;
    }

    if (form.assignment_mode === "ROTATING" && form.rotation_order.length < 2) {
      setSubmitError("Rotation requires at least 2 children.");
      return;
    }

    const scheduleUnit: ScheduleUnit | null =
      scheduleInterval !== null ? form.schedule_unit : null;
    const expiresAt = form.expires_at.trim().length > 0 ? form.expires_at : null;

    setSubmittingForm(true);
    setSubmitError(null);
    try {
      if (editingId !== null) {
        await apiClient.updateChore(editingId, {
          household_id: householdId,
          name,
          reward_cents: form.preserved_reward_cents,
          start_date: form.start_date,
          expires_at: expiresAt,
          timeout_days: timeoutDays,
          schedule_mode: form.schedule_mode,
          schedule_interval: scheduleInterval,
          schedule_unit: scheduleUnit,
          completion_mode: form.completion_mode,
          assignment_mode: form.assignment_mode,
          allowed_child_ids:
            form.assignment_mode === "ROTATING" ? null : form.allowed_child_ids,
          rotation_order:
            form.assignment_mode === "ROTATING" ? form.rotation_order : null,
        });
      } else {
        await apiClient.createChore({
          household_id: householdId,
          name,
          reward_cents: 0,
          start_date: form.start_date,
          expires_at: expiresAt,
          timeout_days: timeoutDays,
          schedule_mode: form.schedule_mode,
          schedule_interval: scheduleInterval,
          schedule_unit: scheduleUnit,
          completion_mode: form.completion_mode,
          assignment_mode: form.assignment_mode,
          allowed_child_ids:
            form.assignment_mode === "ROTATING" ? [] : form.allowed_child_ids,
          rotation_order:
            form.assignment_mode === "ROTATING" ? form.rotation_order : [],
        });
      }

      setShowForm(false);
      setEditingId(null);
      await loadChores();
      await loadChildrenAndEligible();
    } catch (error) {
      setSubmitError(formatError(error));
    } finally {
      setSubmittingForm(false);
    }
  }

  function confirmArchive(chore: Chore) {
    Alert.alert(
      "Archive chore?",
      `"${chore.name}" will stop appearing for children but history stays intact.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          style: "destructive",
          text: "Archive",
          onPress: () => {
            void archiveChore(chore);
          },
        },
      ],
    );
  }

  async function archiveChore(chore: Chore) {
    setArchivingId(chore.id);
    try {
      await apiClient.archiveChore(chore.id, householdId);
      await loadChores();
      await loadChildrenAndEligible();
    } catch (error) {
      setChoresState((previous) => ({
        ...previous,
        error: formatError(error),
      }));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <View>
      <ScreenHeader
        subtitle="Board, submissions, and setup"
        title="Chores"
        trailing={
          <ActionButton
            compact
            label="Add"
            onPress={openCreateForm}
            variant="secondary"
          />
        }
      />

      <SectionCard subtitle={targetDate} title="Daily Board">
        <TextInput
          autoCapitalize="none"
          onChangeText={handleDateChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={targetDate}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            label="Today"
            onPress={() => handleDateChange(todayDateString())}
            variant="secondary"
          />
          <ActionButton
            compact
            disabled={childrenState.loading}
            label={childrenState.loading ? "Refreshing" : "Refresh"}
            onPress={loadChildrenAndEligible}
            variant="secondary"
          />
        </View>
        {childrenState.error !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not load children: ${childrenState.error}`}
          />
        ) : null}
      </SectionCard>

      {childrenState.loading ? (
        <SectionCard title="Available Chores">
          <LoadingRow label="Loading children and available chores" />
        </SectionCard>
      ) : activeChildren.length === 0 ? (
        <SectionCard title="Available Chores">
          <Text style={styles.mutedText}>No active children found.</Text>
        </SectionCard>
      ) : (
        activeChildren.map((child) => {
          const childState = eligibleByChildId[child.id] ?? EMPTY_ELIGIBLE_STATE;
          return (
            <SectionCard
              key={child.id}
              subtitle={`${childState.chores.length} available`}
              title={child.name}
            >
              {childState.loading ? <LoadingRow label="Loading chores" /> : null}
              {childState.error !== null ? (
                <InlineNotice
                  tone="error"
                  message={`Could not load chores: ${childState.error}`}
                />
              ) : null}
              {!childState.loading &&
              childState.error === null &&
              childState.chores.length === 0 ? (
                <Text style={styles.mutedText}>No chores available for this date.</Text>
              ) : null}
              {childState.chores.map((chore) => (
                <View key={chore.chore_id} style={styles.reviewItem}>
                  <View style={styles.splitRow}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{chore.name}</Text>
                      <Text style={styles.rowMeta}>
                        Due {chore.occurrence_date}
                        {chore.expires_on ? ` · Ends ${chore.expires_on}` : ""}
                      </Text>
                    </View>
                    <ActionButton
                      compact
                      disabled={childState.submittingChoreId !== null}
                      label={
                        childState.submittingChoreId === chore.chore_id
                          ? "Submitting"
                          : "Submit"
                      }
                      onPress={() => quickSubmit(child, chore)}
                      variant="secondary"
                    />
                  </View>
                </View>
              ))}
              {childState.message !== null ? (
                <InlineNotice tone="success" message={childState.message} />
              ) : null}
            </SectionCard>
          );
        })
      )}

      <SectionCard
        subtitle={`${selectedChoreIds.length} selected`}
        title="Selected Child Submit"
      >
        <FieldLabel label="Child" />
        <View>
          {activeChildren.map((child) => (
            <Pressable
              accessibilityRole="button"
              key={child.id}
              onPress={() => {
                setSelectedChildId(child.id);
                setSelectedChoreIds([]);
                setSelectedSubmitError(null);
                setSelectedSubmitSuccess(null);
              }}
              style={[
                styles.selectableRow,
                selectedChildId === child.id ? styles.selectableRowSelected : null,
              ]}
            >
              <Text style={styles.rowTitle}>{child.name}</Text>
              <Text
                style={[
                  styles.selectionMark,
                  selectedChildId === child.id
                    ? styles.selectionMarkSelected
                    : null,
                ]}
              >
                {selectedChildId === child.id ? "Selected" : "Select"}
              </Text>
            </Pressable>
          ))}
        </View>
        {selectedChild === null ? (
          <Text style={styles.mutedText}>Select a child to submit multiple chores.</Text>
        ) : null}
        {selectedChild !== null && selectedEligibleState.loading ? (
          <LoadingRow label="Loading available chores" />
        ) : null}
        {selectedChild !== null && selectedEligibleState.error !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not load chores: ${selectedEligibleState.error}`}
          />
        ) : null}
        {selectedEligibleState.chores.map((chore) => (
          <Pressable
            accessibilityRole="button"
            key={chore.chore_id}
            onPress={() => toggleSelectedChore(chore.chore_id)}
            style={[
              styles.selectableRow,
              selectedChoreIds.includes(chore.chore_id)
                ? styles.selectableRowSelected
                : null,
            ]}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{chore.name}</Text>
              <Text style={styles.rowMeta}>
                Due {chore.occurrence_date}
                {chore.expires_on ? ` · Ends ${chore.expires_on}` : ""}
              </Text>
            </View>
            <Text
              style={[
                styles.selectionMark,
                selectedChoreIds.includes(chore.chore_id)
                  ? styles.selectionMarkSelected
                  : null,
              ]}
            >
              {selectedChoreIds.includes(chore.chore_id) ? "Selected" : "Select"}
            </Text>
          </Pressable>
        ))}
        <ActionButton
          disabled={
            selectedSubmitting ||
            selectedChild === null ||
            selectedChoreIds.length === 0
          }
          label={selectedSubmitting ? "Submitting..." : "Submit Selected"}
          onPress={submitSelected}
        />
        {selectedSubmitError !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not submit chores: ${selectedSubmitError}`}
          />
        ) : null}
        {selectedSubmitSuccess !== null ? (
          <InlineNotice tone="success" message={selectedSubmitSuccess} />
        ) : null}
      </SectionCard>

      {showForm ? (
        <ChoreForm
          activeChildren={activeChildren}
          editingId={editingId}
          form={form}
          setField={setField}
          setForm={setForm}
          showInterval={showInterval}
          submitting={submittingForm}
          submitError={submitError}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
            setSubmitError(null);
          }}
          onSubmit={submitChoreForm}
        />
      ) : null}

      <SectionCard title="All Chores">
        {choresState.loading ? <LoadingRow label="Loading chores" /> : null}
        {choresState.error !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not load chores: ${choresState.error}`}
          />
        ) : null}
        {!choresState.loading && choresState.chores.length === 0 ? (
          <Text style={styles.mutedText}>No chores have been created yet.</Text>
        ) : null}
        {choresState.chores.map((chore) => (
          <View key={chore.id} style={styles.reviewItem}>
            <Text style={styles.rowTitle}>{chore.name}</Text>
            <Text style={styles.rowMeta}>
              {scheduleLabel(chore)} ·{" "}
              {chore.completion_mode === "SHARED" ? "Shared" : "Per child"}
            </Text>
            <Text style={styles.rowMeta}>{eligibilityLabel(chore, childrenState.children)}</Text>
            {timingLabel(chore).length > 0 ? (
              <Text style={styles.rowMeta}>{timingLabel(chore)}</Text>
            ) : null}
            {chore.archived_at !== null ? (
              <Text style={[styles.rowMeta, styles.dangerText]}>Archived</Text>
            ) : null}
            <View style={styles.inlineButtons}>
              <ActionButton
                compact
                label="Edit"
                onPress={() => openEditForm(chore)}
                variant="secondary"
              />
              {chore.archived_at === null ? (
                <ActionButton
                  compact
                  disabled={archivingId === chore.id}
                  label={archivingId === chore.id ? "Archiving" : "Archive"}
                  onPress={() => confirmArchive(chore)}
                  variant="danger"
                />
              ) : null}
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

function ChoreForm({
  activeChildren,
  editingId,
  form,
  onCancel,
  onSubmit,
  setField,
  setForm,
  showInterval,
  submitError,
  submitting,
}: {
  activeChildren: Child[];
  editingId: number | null;
  form: MobileChoreFormState;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
  setField: <K extends keyof MobileChoreFormState>(key: K, value: MobileChoreFormState[K]) => void;
  setForm: Dispatch<SetStateAction<MobileChoreFormState>>;
  showInterval: boolean;
  submitError: string | null;
  submitting: boolean;
}) {
  function toggleAllowedChild(childId: number) {
    setField(
      "allowed_child_ids",
      form.allowed_child_ids.includes(childId)
        ? form.allowed_child_ids.filter((id) => id !== childId)
        : [...form.allowed_child_ids, childId],
    );
  }

  function toggleRotationChild(childId: number) {
    setField(
      "rotation_order",
      form.rotation_order.includes(childId)
        ? form.rotation_order.filter((id) => id !== childId)
        : [...form.rotation_order, childId],
    );
  }

  function moveRotation(index: number, direction: -1 | 1) {
    const next = [...form.rotation_order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) {
      return;
    }
    [next[index], next[swap]] = [next[swap], next[index]];
    setField("rotation_order", next);
  }

  return (
    <SectionCard title={editingId !== null ? "Edit Chore" : "New Chore"}>
      <View style={styles.compactStack}>
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={(value) => setField("name", value)}
          placeholder="Take out trash"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.name}
        />
        <FieldLabel label="Start Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => setField("start_date", value)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.start_date}
        />
        <FieldLabel label="Global End Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => setField("expires_at", value)}
          placeholder="Optional YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.expires_at}
        />
        <FieldLabel label="Completion Window Days" />
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => setField("timeout_days", value)}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.timeout_days}
        />
        <FieldLabel label="Schedule" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) =>
            setForm((previous) => ({
              ...previous,
              schedule_mode: value,
              schedule_interval:
                value === "EVERY" || value === "AFTER_COMPLETION"
                  ? previous.schedule_interval
                  : "",
            }))
          }
          options={scheduleOptions}
          value={form.schedule_mode}
        />
        {showInterval ? (
          <>
            <FieldLabel label="Interval" />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setField("schedule_interval", value)}
              placeholder="1"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={form.schedule_interval}
            />
            <FieldLabel label="Interval Unit" />
            <ChoiceGroup
              disabled={submitting}
              onChange={(value) => setField("schedule_unit", value)}
              options={scheduleUnitOptions}
              value={form.schedule_unit}
            />
          </>
        ) : null}
        <FieldLabel label="Completion" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) => setField("completion_mode", value)}
          options={completionOptions}
          value={form.completion_mode}
        />
        <FieldLabel label="Assignment" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) =>
            setForm((previous) => ({
              ...previous,
              assignment_mode: value,
              allowed_child_ids:
                value === "ROTATING" ? [] : previous.allowed_child_ids,
              rotation_order:
                value === "STATIC" ? [] : previous.rotation_order,
            }))
          }
          options={assignmentOptions}
          value={form.assignment_mode}
        />
        {form.assignment_mode === "STATIC" ? (
          <>
            <Text style={styles.mutedText}>
              Leave every child unselected to allow all active children.
            </Text>
            {activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => toggleAllowedChild(child.id)}
                style={[
                  styles.selectableRow,
                  form.allowed_child_ids.includes(child.id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <Text style={styles.rowTitle}>{child.name}</Text>
                <Text
                  style={[
                    styles.selectionMark,
                    form.allowed_child_ids.includes(child.id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {form.allowed_child_ids.includes(child.id) ? "Allowed" : "Any"}
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => toggleRotationChild(child.id)}
                style={[
                  styles.selectableRow,
                  form.rotation_order.includes(child.id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <Text style={styles.rowTitle}>{child.name}</Text>
                <Text
                  style={[
                    styles.selectionMark,
                    form.rotation_order.includes(child.id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {form.rotation_order.includes(child.id) ? "In rotation" : "Add"}
                </Text>
              </Pressable>
            ))}
            {form.rotation_order.map((childId, index) => {
              const childName =
                activeChildren.find((child) => child.id === childId)?.name ??
                `#${childId}`;
              return (
                <View key={childId} style={styles.reviewItem}>
                  <Text style={styles.rowTitle}>
                    {index + 1}. {childName}
                  </Text>
                  <View style={styles.inlineButtons}>
                    <ActionButton
                      compact
                      disabled={index === 0}
                      label="Up"
                      onPress={() => moveRotation(index, -1)}
                      variant="secondary"
                    />
                    <ActionButton
                      compact
                      disabled={index === form.rotation_order.length - 1}
                      label="Down"
                      onPress={() => moveRotation(index, 1)}
                      variant="secondary"
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}
        {submitError !== null ? (
          <InlineNotice tone="error" message={submitError} />
        ) : null}
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={submitting}
            label={submitting ? "Saving..." : "Save Chore"}
            onPress={() => {
              void onSubmit();
            }}
          />
          <ActionButton
            compact
            disabled={submitting}
            label="Cancel"
            onPress={onCancel}
            variant="secondary"
          />
        </View>
      </View>
    </SectionCard>
  );
}
