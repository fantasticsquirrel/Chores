import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  apiClient,
  type AssignmentMode,
  type Chore,
  type CompletionMode,
  type ScheduleMode,
  type ScheduleUnit,
} from "../api";
import { useAuth } from "../auth/useAuth";
import { Badge, Button, Card, FormField, InlineNotice, TextInput } from "../ui";

type PageState = {
  chores: Chore[];
  loading: boolean;
  error: string | null;
};

type FormState = {
  name: string;
  reward_dollars: string;
  start_date: string;
  schedule_mode: ScheduleMode;
  schedule_interval: string;
  schedule_unit: ScheduleUnit;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
};

const DEFAULT_FORM: FormState = {
  name: "",
  reward_dollars: "0.00",
  start_date: new Date().toISOString().slice(0, 10),
  schedule_mode: "NONE",
  schedule_interval: "1",
  schedule_unit: "WEEK",
  completion_mode: "PER_CHILD",
  assignment_mode: "STATIC",
};

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
      return `Once (${chore.start_date})`;
    case "EVERY":
      return `Every ${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""}`;
    case "AFTER_COMPLETION":
      return `${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""} after completion`;
    default:
      return chore.schedule_mode;
  }
}

export function ParentChoresPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;

  const [state, setState] = useState<PageState>({ chores: [], loading: true, error: null });
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const loadChores = useCallback(async (): Promise<void> => {
    if (householdId === null) {
      setState({ chores: [], loading: false, error: "Could not determine household scope." });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const chores = await apiClient.listChores({ household_id: householdId, active_only: false });
      setState({ chores, loading: false, error: null });
    } catch (error: unknown) {
      setState({ chores: [], loading: false, error: formatError(error) });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChores();
  }, [loadChores]);

  function openCreateForm(): void {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setSubmitError(null);
    setShowForm(true);
  }

  function openEditForm(chore: Chore): void {
    setEditingId(chore.id);
    setForm({
      name: chore.name,
      reward_dollars: (chore.reward_cents / 100).toFixed(2),
      start_date: chore.start_date,
      schedule_mode: chore.schedule_mode,
      schedule_interval: String(chore.schedule_interval ?? 1),
      schedule_unit: chore.schedule_unit ?? "WEEK",
      completion_mode: chore.completion_mode,
      assignment_mode: chore.assignment_mode,
    });
    setSubmitError(null);
    setShowForm(true);
  }

  function cancelForm(): void {
    setShowForm(false);
    setEditingId(null);
    setSubmitError(null);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;

    const name = form.name.trim();
    if (name.length === 0) {
      setSubmitError("Chore name is required.");
      return;
    }

    const rewardCents = Math.round(parseFloat(form.reward_dollars) * 100);
    if (isNaN(rewardCents) || rewardCents < 0) {
      setSubmitError("Reward must be a non-negative number.");
      return;
    }

    const needsInterval = form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";
    const scheduleInterval = needsInterval ? parseInt(form.schedule_interval, 10) : null;
    const scheduleUnit: ScheduleUnit | null = needsInterval ? form.schedule_unit : null;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (editingId !== null) {
        await apiClient.updateChore(editingId, {
          household_id: householdId,
          name,
          reward_cents: rewardCents,
          start_date: form.start_date,
          schedule_mode: form.schedule_mode,
          schedule_interval: scheduleInterval,
          schedule_unit: scheduleUnit,
          completion_mode: form.completion_mode,
          assignment_mode: form.assignment_mode,
        });
      } else {
        await apiClient.createChore({
          household_id: householdId,
          name,
          reward_cents: rewardCents,
          start_date: form.start_date,
          schedule_mode: form.schedule_mode,
          schedule_interval: scheduleInterval,
          schedule_unit: scheduleUnit,
          completion_mode: form.completion_mode,
          assignment_mode: form.assignment_mode,
        });
      }
      setShowForm(false);
      setEditingId(null);
      await loadChores();
    } catch (error: unknown) {
      setSubmitError(formatError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(chore: Chore): Promise<void> {
    if (householdId === null) return;
    if (!confirm(`Archive "${chore.name}"? It won't appear for children but history is preserved.`)) return;

    setArchivingId(chore.id);
    try {
      await apiClient.archiveChore(chore.id, householdId);
      await loadChores();
    } catch (error: unknown) {
      setState((prev) => ({ ...prev, error: formatError(error) }));
    } finally {
      setArchivingId(null);
    }
  }

  const showInterval = form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";

  return (
    <section className="dashboard-grid" aria-label="Chore management">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Chores</h1>
          <Badge>Household {householdId ?? "Unknown"}</Badge>
        </div>
        <p>Create and manage chores for this household.</p>
        {!showForm ? (
          <Button type="button" onClick={openCreateForm}>
            + Add Chore
          </Button>
        ) : null}
      </Card>

      {showForm ? (
        <Card className="dashboard-panel">
          <div className="panel-header-row">
            <h2>{editingId !== null ? "Edit Chore" : "New Chore"}</h2>
          </div>
          <form className="children-form" onSubmit={(e) => void handleSubmit(e)}>
            <FormField label="Name">
              <TextInput
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Take out trash"
                maxLength={255}
                disabled={submitting}
              />
            </FormField>

            <FormField label="Reward ($)">
              <TextInput
                type="number"
                value={form.reward_dollars}
                onChange={(e) => setField("reward_dollars", e.target.value)}
                placeholder="1.00"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Start Date">
              <TextInput
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                disabled={submitting}
              />
            </FormField>

            <FormField label="Schedule">
              <select
                value={form.schedule_mode}
                onChange={(e) => setField("schedule_mode", e.target.value as ScheduleMode)}
                disabled={submitting}
                className="text-input"
              >
                <option value="NONE">On-demand</option>
                <option value="ONCE">Once</option>
                <option value="EVERY">Repeating (every N)</option>
                <option value="AFTER_COMPLETION">After completion</option>
              </select>
            </FormField>

            {showInterval ? (
              <FormField label="Interval">
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <TextInput
                    type="number"
                    value={form.schedule_interval}
                    onChange={(e) => setField("schedule_interval", e.target.value)}
                    placeholder="1"
                    disabled={submitting}
                    style={{ width: "5rem" }}
                  />
                  <select
                    value={form.schedule_unit}
                    onChange={(e) => setField("schedule_unit", e.target.value as ScheduleUnit)}
                    disabled={submitting}
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
                onChange={(e) => setField("completion_mode", e.target.value as CompletionMode)}
                disabled={submitting}
                className="text-input"
              >
                <option value="PER_CHILD">Per child</option>
                <option value="SHARED">Shared (anyone can complete)</option>
              </select>
            </FormField>

            <FormField label="Assignment">
              <select
                value={form.assignment_mode}
                onChange={(e) => setField("assignment_mode", e.target.value as AssignmentMode)}
                disabled={submitting}
                className="text-input"
              >
                <option value="STATIC">Static (always same child)</option>
                <option value="ROTATING">Rotating</option>
              </select>
            </FormField>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId !== null ? "Save Changes" : "Create Chore"}
              </Button>
              <Button type="button" onClick={cancelForm} disabled={submitting}>
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
        </div>

        {state.loading ? <p>Loading chores...</p> : null}

        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load chores: {state.error}</InlineNotice>
        ) : null}

        {!state.loading && state.error === null && state.chores.length === 0 ? (
          <p>No chores yet. Add one above to get started.</p>
        ) : null}

        {!state.loading && state.error === null && state.chores.length > 0 ? (
          <ul className="balance-list" aria-label="Chores list">
            {state.chores.map((chore) => {
              const isArchiving = archivingId === chore.id;
              return (
                <li key={chore.id} className="balance-item">
                  <div style={{ flex: 1 }}>
                    <p className="balance-name">
                      {chore.name}
                      {!chore.is_active ? (
                        <span style={{ marginLeft: "0.5rem", opacity: 0.5, fontSize: "0.8em" }}>
                          [archived]
                        </span>
                      ) : null}
                    </p>
                    <p className="balance-meta">
                      ${chore.reward_dollars.toFixed(2)} · {scheduleLabel(chore)} · {chore.completion_mode} · {chore.assignment_mode}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {chore.is_active ? (
                      <>
                        <Button onClick={() => openEditForm(chore)} disabled={isArchiving}>
                          Edit
                        </Button>
                        <Button onClick={() => void handleArchive(chore)} disabled={isArchiving}>
                          {isArchiving ? "Archiving..." : "Archive"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
