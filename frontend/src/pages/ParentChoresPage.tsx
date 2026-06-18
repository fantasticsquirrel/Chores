import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiClient,
  type Child,
  type Chore,
  type EligibleChore,
  type ScheduleUnit,
} from "../api";
import { useAuth } from "../auth/useAuth";
import { ChoreForm, type ChoreFormState } from "../features/chores/components/ChoreForm";
import { ChoreList } from "../features/chores/components/ChoreList";
import { EligibleChorePanel } from "../features/chores/components/EligibleChorePanel";
import { parseOptionalPositiveInteger } from "../features/chores/lib/choreForm";
import { formatApiError } from "../lib/errors";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DateInput,
  FormField,
  InlineNotice,
} from "../ui";

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

type FormState = ChoreFormState;


const EMPTY_ELIGIBLE_STATE: EligibleChildState = {
  chores: [],
  loading: false,
  error: null,
  message: null,
  submittingChoreId: null,
};

function buildTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultForm(): ChoreFormState {
  return {
    name: "",
    start_date: buildTodayIsoDate(),
    expires_at: "",
    timeout_days: "",
    schedule_mode: "NONE",
    schedule_interval: "1",
    schedule_unit: "WEEK",
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    allowed_child_ids: [],
    rotation_order: [],
  };
}

export function ParentChoresPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const [targetDate, setTargetDate] = useState(buildTodayIsoDate);
  const [childrenState, setChildrenState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [eligibleByChildId, setEligibleByChildId] = useState<
    Record<number, EligibleChildState>
  >({});
  const [selectedChildId, setSelectedChildId] = useState("");
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
  const [form, setForm] = useState<ChoreFormState>(buildDefaultForm);
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
    activeChildren.find((child) => child.id.toString() === selectedChildId) ??
    null;
  const selectedEligibleState =
    selectedChild !== null
      ? (eligibleByChildId[selectedChild.id] ?? EMPTY_ELIGIBLE_STATE)
      : EMPTY_ELIGIBLE_STATE;
  const showInterval =
    form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";

  const loadChores = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setChoresState({
        chores: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      return;
    }

    setChoresState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const chores = await apiClient.listChores({
        household_id: householdId,
        active_only: false,
      });
      setChoresState({ chores, loading: false, error: null });
    } catch (error: unknown) {
      setChoresState({ chores: [], loading: false, error: formatApiError(error) });
    }
  }, [householdId]);

  const refreshEligibleForChild = useCallback(
    async (
      childId: number,
      options: { preserveMessage?: boolean } = {},
    ): Promise<void> => {
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
      } catch (error: unknown) {
        setEligibleByChildId((previous) => ({
          ...previous,
          [childId]: {
            ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
            chores: [],
            loading: false,
            error: formatApiError(error),
            message: null,
            submittingChoreId: null,
          },
        }));
        setSelectedChoreIds([]);
      }
    },
    [targetDate],
  );

  const loadChildrenAndEligible = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setChildrenState({
        children: [],
        loading: false,
        error: "Could not determine household scope.",
      });
      setEligibleByChildId({});
      return;
    }

    setChildrenState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
    setSelectedChoreIds([]);

    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      const active = children.filter((child) => child.active);
      setChildrenState({ children, loading: false, error: null });
      setSelectedChildId((previous) =>
        previous.length > 0 &&
        active.some((child) => child.id.toString() === previous)
          ? previous
          : (active[0]?.id.toString() ?? ""),
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
          } catch (error: unknown) {
            return [
              child.id,
              { ...EMPTY_ELIGIBLE_STATE, error: formatApiError(error) },
            ] as const;
          }
        }),
      );

      setEligibleByChildId(Object.fromEntries(results));
    } catch (error: unknown) {
      setChildrenState({
        children: [],
        loading: false,
        error: formatApiError(error),
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
  ): void {
    setEligibleByChildId((previous) => ({
      ...previous,
      [childId]: {
        ...(previous[childId] ?? EMPTY_ELIGIBLE_STATE),
        ...patch,
      },
    }));
  }

  function handleDateChange(nextDate: string): void {
    setTargetDate(nextDate);
    setSelectedChoreIds([]);
    setSelectedSubmitError(null);
    setSelectedSubmitSuccess(null);
  }

  function toggleSelectedChore(choreId: number): void {
    setSelectedChoreIds((previous) =>
      previous.includes(choreId)
        ? previous.filter((id) => id !== choreId)
        : [...previous, choreId],
    );
  }

  async function handleQuickSubmit(
    child: Child,
    chore: EligibleChore,
  ): Promise<void> {
    if (
      !window.confirm(
        `Submit "${chore.name}" for ${child.name} on ${targetDate}?`,
      )
    )
      return;

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
    } catch (error: unknown) {
      setEligibleChildState(child.id, {
        error: formatApiError(error),
        submittingChoreId: null,
        message: null,
      });
    }
  }

  async function handleSelectedSubmit(): Promise<void> {
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
    } catch (error: unknown) {
      setSelectedSubmitError(formatApiError(error));
    } finally {
      setSelectedSubmitting(false);
    }
  }

  function openCreateForm(): void {
    setEditingId(null);
    setForm(buildDefaultForm());
    setSubmitError(null);
    setShowForm(true);
  }

  function openEditForm(chore: Chore): void {
    setEditingId(chore.id);
    setForm({
      name: chore.name,
      start_date: chore.start_date,
      expires_at: chore.expires_at ?? "",
      timeout_days: chore.timeout_days?.toString() ?? "",
      schedule_mode: chore.schedule_mode,
      schedule_interval: String(chore.schedule_interval ?? 1),
      schedule_unit: chore.schedule_unit ?? "WEEK",
      completion_mode: chore.completion_mode,
      assignment_mode: chore.assignment_mode,
      allowed_child_ids: chore.allowed_child_ids,
      rotation_order: chore.rotation_order,
    });
    setSubmitError(null);
    setShowForm(true);
  }

  function cancelForm(): void {
    setShowForm(false);
    setEditingId(null);
    setSubmitError(null);
  }

  function setField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;

    const name = form.name.trim();
    if (name.length === 0) {
      setSubmitError("Chore name is required.");
      return;
    }

    let timeoutDays: number | null;
    let scheduleInterval: number | null;
    try {
      timeoutDays = parseOptionalPositiveInteger(form.timeout_days, "Timeout");
      const needsInterval =
        form.schedule_mode === "EVERY" ||
        form.schedule_mode === "AFTER_COMPLETION";
      scheduleInterval = needsInterval
        ? parseOptionalPositiveInteger(form.schedule_interval, "Interval")
        : null;
      if (needsInterval && scheduleInterval === null) {
        setSubmitError("Interval is required for repeating schedules.");
        return;
      }
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
      return;
    }

    const scheduleUnit: ScheduleUnit | null =
      scheduleInterval !== null ? form.schedule_unit : null;

    if (form.assignment_mode === "ROTATING" && form.rotation_order.length < 2) {
      setSubmitError("Rotation requires at least 2 children.");
      return;
    }

    setSubmittingForm(true);
    setSubmitError(null);

    try {
      if (editingId !== null) {
        await apiClient.updateChore(editingId, {
          household_id: householdId,
          name,
          start_date: form.start_date,
          expires_at:
            form.expires_at.trim().length > 0 ? form.expires_at : null,
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
          expires_at:
            form.expires_at.trim().length > 0 ? form.expires_at : null,
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
    } catch (error: unknown) {
      setSubmitError(formatApiError(error));
    } finally {
      setSubmittingForm(false);
    }
  }

  async function handleArchive(chore: Chore): Promise<void> {
    if (householdId === null) return;
    if (
      !window.confirm(
        `Archive "${chore.name}"? It will stop appearing for children but history stays intact.`,
      )
    )
      return;

    setArchivingId(chore.id);
    try {
      await apiClient.archiveChore(chore.id, householdId);
      await loadChores();
      await loadChildrenAndEligible();
    } catch (error: unknown) {
      setChoresState((previous) => ({
        ...previous,
        error: formatApiError(error),
      }));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Parent chore tracker">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Parent workspace</p>
            <h1>Chores</h1>
          </div>
          <Badge>
            {activeChildren.length} active child
            {activeChildren.length === 1 ? "" : "ren"}
          </Badge>
        </div>
        <p>
          Review what is available, submit completed chores for children, and
          maintain the household chore setup.
        </p>
        <div className="quick-actions">
          <Button
            type="button"
            onClick={() => void loadChildrenAndEligible()}
            disabled={childrenState.loading}
          >
            {childrenState.loading ? "Refreshing..." : "Refresh"}
          </Button>
          <ButtonLink to="/board">Review Submissions</ButtonLink>
          <Button type="button" onClick={openCreateForm}>
            Add Chore
          </Button>
        </div>
      </Card>

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Daily Board</h2>
          <Badge>{targetDate}</Badge>
        </div>
        <form
          className="children-form today-controls"
          onSubmit={(event) => event.preventDefault()}
        >
          <FormField label="Date">
            <DateInput
              value={targetDate}
              onChange={(event) => handleDateChange(event.target.value)}
              max="9999-12-31"
            />
          </FormField>
          <Button
            type="button"
            onClick={() => handleDateChange(buildTodayIsoDate())}
          >
            Today
          </Button>
        </form>

        {childrenState.loading ? (
          <p>Loading children and available chores...</p>
        ) : null}
        {!childrenState.loading && childrenState.error !== null ? (
          <InlineNotice variant="error">
            Could not load children: {childrenState.error}
          </InlineNotice>
        ) : null}
        {!childrenState.loading &&
        childrenState.error === null &&
        activeChildren.length === 0 ? (
          <p>No active children found for this household.</p>
        ) : null}
      </Card>

      {!childrenState.loading && childrenState.error === null
        ? activeChildren.map((child) => (
            <EligibleChorePanel
              key={child.id}
              child={child}
              state={eligibleByChildId[child.id] ?? EMPTY_ELIGIBLE_STATE}
              onQuickSubmit={(panelChild, chore) => void handleQuickSubmit(panelChild, chore)}
            />
          ))
        : null}

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Selected Child Submit</h2>
          <Badge>{selectedChoreIds.length} selected</Badge>
        </div>
        <form
          className="children-form today-controls"
          onSubmit={(event) => event.preventDefault()}
        >
          <FormField label="Child">
            <select
              className="text-input"
              value={selectedChildId}
              onChange={(event) => {
                setSelectedChildId(event.target.value);
                setSelectedChoreIds([]);
                setSelectedSubmitError(null);
                setSelectedSubmitSuccess(null);
              }}
            >
              <option value="">Select child</option>
              {activeChildren.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </FormField>
          <Button
            type="button"
            onClick={() => {
              if (selectedChild !== null)
                void refreshEligibleForChild(selectedChild.id);
            }}
            disabled={selectedChild === null || selectedEligibleState.loading}
          >
            Refresh
          </Button>
        </form>

        {selectedChild === null ? (
          <p>Select a child to submit multiple completed chores.</p>
        ) : null}
        {selectedChild !== null && selectedEligibleState.loading ? (
          <p>Loading available chores...</p>
        ) : null}
        {selectedChild !== null && selectedEligibleState.error !== null ? (
          <InlineNotice variant="error">
            Could not load chores: {selectedEligibleState.error}
          </InlineNotice>
        ) : null}
        {selectedChild !== null &&
        !selectedEligibleState.loading &&
        selectedEligibleState.error === null &&
        selectedEligibleState.chores.length === 0 ? (
          <p>No chores available for this child on {targetDate}.</p>
        ) : null}
        {selectedChild !== null &&
        !selectedEligibleState.loading &&
        selectedEligibleState.error === null &&
        selectedEligibleState.chores.length > 0 ? (
          <ul className="balance-list" aria-label="Selected child chores">
            {selectedEligibleState.chores.map((chore) => (
              <li key={chore.chore_id} className="balance-item">
                <label className="checkbox-row task-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedChoreIds.includes(chore.chore_id)}
                    onChange={() => toggleSelectedChore(chore.chore_id)}
                    disabled={selectedSubmitting}
                  />
                  <span>
                    <span className="balance-name">{chore.name}</span>
                    <span className="balance-meta">
                      Due {chore.occurrence_date}
                      {chore.expires_on !== null &&
                      chore.expires_on !== undefined
                        ? ` - Ends ${chore.expires_on}`
                        : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="quick-actions">
          <Button
            type="button"
            onClick={() => void handleSelectedSubmit()}
            disabled={
              selectedSubmitting ||
              selectedChild === null ||
              selectedChoreIds.length === 0
            }
          >
            {selectedSubmitting ? "Submitting..." : "Submit Selected Chores"}
          </Button>
        </div>
        {selectedSubmitError !== null ? (
          <InlineNotice variant="error">
            Could not submit chores: {selectedSubmitError}
          </InlineNotice>
        ) : null}
        {selectedSubmitSuccess !== null ? (
          <InlineNotice variant="success">{selectedSubmitSuccess}</InlineNotice>
        ) : null}
      </Card>

      <div className="dashboard-section-header">
        <p className="eyebrow">Setup</p>
        <h2>Chore Management</h2>
        <p>Create, edit, rotate, and archive household chores.</p>
      </div>

      {showForm ? (
        <ChoreForm
          children={childrenState.children}
          editingId={editingId}
          form={form}
          onCancel={cancelForm}
          onSubmit={(event) => void handleSubmit(event)}
          setField={setField}
          showInterval={showInterval}
          submitError={submitError}
          submitting={submittingForm}
        />
      ) : null}

      <ChoreList
        archivingId={archivingId}
        children={childrenState.children}
        choresState={choresState}
        onArchive={(chore) => void handleArchive(chore)}
        onCreate={openCreateForm}
        onEdit={openEditForm}
        showForm={showForm}
      />
    </section>
  );
}
