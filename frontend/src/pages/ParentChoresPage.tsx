import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiClientError,
  apiClient,
  type AssignmentMode,
  type Child,
  type Chore,
  type CompletionMode,
  type EligibleChore,
  type ScheduleMode,
  type ScheduleUnit,
} from "../api";
import { useAuth } from "../auth/useAuth";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DateInput,
  FormField,
  InlineNotice,
  TextInput,
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

type FormState = {
  name: string;
  start_date: string;
  expires_at: string;
  timeout_days: string;
  schedule_mode: ScheduleMode;
  schedule_interval: string;
  schedule_unit: ScheduleUnit;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
  allowed_child_ids: number[];
  rotation_order: number[];
};

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

function buildDefaultForm(): FormState {
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

function formatError(error: unknown): string {
  if (error instanceof ApiClientError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function scheduleLabel(chore: Chore): string {
  switch (chore.schedule_mode) {
    case "NONE":
      return "On-demand";
    case "ONCE":
      return `Once on ${chore.start_date}`;
    case "EVERY":
      return `Every ${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""}`;
    case "AFTER_COMPLETION":
      return `${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""} after completion`;
    default:
      return chore.schedule_mode;
  }
}

function completionLabel(mode: CompletionMode): string {
  return mode === "SHARED" ? "Shared completion" : "Per-child completion";
}

function eligibilityLabel(chore: Chore, children: Child[]): string {
  if (chore.assignment_mode === "ROTATING") {
    const names = chore.rotation_order
      .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
      .join(" then ");
    return `Rotation: ${names || "none set"}`;
  }

  if (chore.allowed_child_ids.length === 0) return "All children";
  return chore.allowed_child_ids
    .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
    .join(", ");
}

function buildTimingLabel(chore: Chore): string {
  const labels: string[] = [];
  if (chore.expires_at !== null) labels.push(`Ends ${chore.expires_at}`);
  if (chore.timeout_days !== null)
    labels.push(
      `Window ${chore.timeout_days} day${chore.timeout_days === 1 ? "" : "s"}`,
    );
  return labels.join(" - ");
}

function parseOptionalPositiveInteger(
  value: string,
  fieldName: string,
): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }
  return parsed;
}

type ChildChecklistProps = {
  children: Child[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
};

function ChildChecklist({
  children,
  selected,
  onChange,
  disabled,
}: ChildChecklistProps): ReactElement {
  function toggle(id: number): void {
    onChange(
      selected.includes(id)
        ? selected.filter((childId) => childId !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input
            type="checkbox"
            checked={selected.includes(child.id)}
            onChange={() => toggle(child.id)}
            disabled={disabled}
          />
          <span>
            {child.name}
            {!child.active ? (
              <span className="muted-inline">inactive</span>
            ) : null}
          </span>
        </label>
      ))}
      {children.length === 0 ? <p>No children in household yet.</p> : null}
    </div>
  );
}

type RotationOrderProps = {
  children: Child[];
  order: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
};

function RotationOrderList({
  children,
  order,
  onChange,
  disabled,
}: RotationOrderProps): ReactElement {
  const inRotation = new Set(order);

  function move(index: number, direction: -1 | 1): void {
    const next = [...order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }

  function toggleChild(id: number): void {
    onChange(
      order.includes(id)
        ? order.filter((childId) => childId !== id)
        : [...order, id],
    );
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input
            type="checkbox"
            checked={inRotation.has(child.id)}
            onChange={() => toggleChild(child.id)}
            disabled={disabled}
          />
          {child.name}
        </label>
      ))}

      {order.length > 0 ? (
        <ol className="rotation-order-list" aria-label="Rotation order">
          {order.map((id, index) => {
            const name =
              children.find((child) => child.id === id)?.name ?? `#${id}`;
            return (
              <li key={id}>
                <span>{name}</span>
                <div className="item-actions">
                  <Button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === order.length - 1}
                  >
                    Down
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
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
  const [form, setForm] = useState<FormState>(buildDefaultForm);
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
      setChoresState({ chores: [], loading: false, error: formatError(error) });
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
              { ...EMPTY_ELIGIBLE_STATE, error: formatError(error) },
            ] as const;
          }
        }),
      );

      setEligibleByChildId(Object.fromEntries(results));
    } catch (error: unknown) {
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
        error: formatError(error),
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
      setSelectedSubmitError(formatError(error));
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
      setSubmitError(formatError(error));
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
      setSubmitError(formatError(error));
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
        error: formatError(error),
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
        ? activeChildren.map((child) => {
            const childState =
              eligibleByChildId[child.id] ?? EMPTY_ELIGIBLE_STATE;
            return (
              <Card key={child.id} className="parent-child-chore-card">
                <div className="panel-header-row">
                  <h3>{child.name}</h3>
                  <Badge>{childState.chores.length} available</Badge>
                </div>
                {childState.loading ? <p>Loading chores...</p> : null}
                {childState.error !== null ? (
                  <InlineNotice variant="error">
                    Could not load chores: {childState.error}
                  </InlineNotice>
                ) : null}
                {!childState.loading &&
                childState.error === null &&
                childState.chores.length === 0 ? (
                  <p>No chores available for this date.</p>
                ) : null}
                {!childState.loading &&
                childState.error === null &&
                childState.chores.length > 0 ? (
                  <div
                    className="chore-button-list"
                    aria-label={`${child.name} available chores`}
                  >
                    {childState.chores.map((chore) => (
                      <Button
                        key={chore.chore_id}
                        type="button"
                        className="chore-submit-button"
                        onClick={() => void handleQuickSubmit(child, chore)}
                        disabled={childState.submittingChoreId !== null}
                      >
                        <span>{chore.name}</span>
                        {chore.expires_on !== null &&
                        chore.expires_on !== undefined ? (
                          <small>Ends {chore.expires_on}</small>
                        ) : null}
                        <strong>
                          {childState.submittingChoreId === chore.chore_id
                            ? "Submitting..."
                            : "Submit"}
                        </strong>
                      </Button>
                    ))}
                  </div>
                ) : null}
                {childState.message !== null ? (
                  <InlineNotice variant="success">
                    {childState.message}
                  </InlineNotice>
                ) : null}
              </Card>
            );
          })
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
        <Card className="dashboard-panel">
          <div className="panel-header-row">
            <h2>{editingId !== null ? "Edit Chore" : "New Chore"}</h2>
          </div>
          <form
            className="children-form chore-management-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <FormField label="Name">
              <TextInput
                type="text"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Take out trash"
                maxLength={255}
                disabled={submittingForm}
              />
            </FormField>

            <FormField label="Start Date">
              <DateInput
                value={form.start_date}
                onChange={(event) => setField("start_date", event.target.value)}
                disabled={submittingForm}
              />
            </FormField>

            <FormField label="Global End Date">
              <DateInput
                value={form.expires_at}
                onChange={(event) => setField("expires_at", event.target.value)}
                disabled={submittingForm}
              />
            </FormField>

            <FormField label="Completion Window Days">
              <TextInput
                type="number"
                min="1"
                value={form.timeout_days}
                onChange={(event) =>
                  setField("timeout_days", event.target.value)
                }
                disabled={submittingForm}
              />
            </FormField>

            <FormField label="Schedule">
              <select
                value={form.schedule_mode}
                onChange={(event) =>
                  setField("schedule_mode", event.target.value as ScheduleMode)
                }
                disabled={submittingForm}
                className="text-input"
              >
                <option value="NONE">On-demand</option>
                <option value="ONCE">Once</option>
                <option value="EVERY">Repeating</option>
                <option value="AFTER_COMPLETION">After completion</option>
              </select>
            </FormField>

            {showInterval ? (
              <FormField label="Interval">
                <div className="inline-field-row">
                  <TextInput
                    type="number"
                    min="1"
                    value={form.schedule_interval}
                    onChange={(event) =>
                      setField("schedule_interval", event.target.value)
                    }
                    disabled={submittingForm}
                  />
                  <select
                    value={form.schedule_unit}
                    onChange={(event) =>
                      setField(
                        "schedule_unit",
                        event.target.value as ScheduleUnit,
                      )
                    }
                    disabled={submittingForm}
                    className="text-input"
                  >
                    <option value="DAY">Day(s)</option>
                    <option value="WEEK">Week(s)</option>
                    <option value="MONTH">Month(s)</option>
                  </select>
                </div>
              </FormField>
            ) : null}

            <FormField label="Completion">
              <select
                value={form.completion_mode}
                onChange={(event) =>
                  setField(
                    "completion_mode",
                    event.target.value as CompletionMode,
                  )
                }
                disabled={submittingForm}
                className="text-input"
              >
                <option value="PER_CHILD">Per child</option>
                <option value="SHARED">Shared</option>
              </select>
            </FormField>

            <FormField label="Assignment">
              <select
                value={form.assignment_mode}
                onChange={(event) =>
                  setField(
                    "assignment_mode",
                    event.target.value as AssignmentMode,
                  )
                }
                disabled={submittingForm}
                className="text-input"
              >
                <option value="STATIC">Static</option>
                <option value="ROTATING">Rotating</option>
              </select>
            </FormField>

            {form.assignment_mode === "ROTATING" ? (
              <fieldset className="plain-fieldset">
                <legend>Rotation Order</legend>
                <RotationOrderList
                  children={childrenState.children}
                  order={form.rotation_order}
                  onChange={(ids) => setField("rotation_order", ids)}
                  disabled={submittingForm}
                />
              </fieldset>
            ) : (
              <fieldset className="plain-fieldset">
                <legend>Who can complete? Empty means all children.</legend>
                <ChildChecklist
                  children={childrenState.children}
                  selected={form.allowed_child_ids}
                  onChange={(ids) => setField("allowed_child_ids", ids)}
                  disabled={submittingForm}
                />
              </fieldset>
            )}

            <div className="quick-actions">
              <Button type="submit" disabled={submittingForm}>
                {submittingForm
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create Chore"}
              </Button>
              <Button
                type="button"
                onClick={cancelForm}
                disabled={submittingForm}
              >
                Cancel
              </Button>
            </div>

            {submitError !== null ? (
              <InlineNotice variant="error">{submitError}</InlineNotice>
            ) : null}
          </form>
        </Card>
      ) : null}

      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>All Chores</h2>
          {!showForm ? (
            <Button type="button" onClick={openCreateForm}>
              Add Chore
            </Button>
          ) : null}
        </div>

        {choresState.loading ? <p>Loading chores...</p> : null}
        {!choresState.loading && choresState.error !== null ? (
          <InlineNotice variant="error">
            Could not load chores: {choresState.error}
          </InlineNotice>
        ) : null}
        {!choresState.loading &&
        choresState.error === null &&
        choresState.chores.length === 0 ? (
          <p>No chores yet. Add one above to get started.</p>
        ) : null}

        {!choresState.loading &&
        choresState.error === null &&
        choresState.chores.length > 0 ? (
          <ul className="balance-list" aria-label="Chores list">
            {choresState.chores.map((chore) => {
              const isArchiving = archivingId === chore.id;
              const timingLabel = buildTimingLabel(chore);
              return (
                <li key={chore.id} className="balance-item">
                  <div>
                    <p className="balance-name">
                      {chore.name}
                      {!chore.is_active ? (
                        <span className="muted-inline">archived</span>
                      ) : null}
                    </p>
                    <p className="balance-meta">
                      {scheduleLabel(chore)} -{" "}
                      {completionLabel(chore.completion_mode)}
                    </p>
                    {timingLabel.length > 0 ? (
                      <p className="balance-meta">{timingLabel}</p>
                    ) : null}
                    <p className="balance-meta">
                      Assigned:{" "}
                      {eligibilityLabel(chore, childrenState.children)}
                    </p>
                  </div>
                  {chore.is_active ? (
                    <div className="item-actions">
                      <Button
                        type="button"
                        onClick={() => openEditForm(chore)}
                        disabled={isArchiving}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleArchive(chore)}
                        disabled={isArchiving}
                      >
                        {isArchiving ? "Archiving..." : "Archive"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
