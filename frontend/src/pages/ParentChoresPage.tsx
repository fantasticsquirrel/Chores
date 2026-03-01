import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  apiClient,
  type AssignmentMode,
  type Child,
  type Chore,
  type CompletionMode,
  type ScheduleMode,
  type ScheduleUnit,
} from "../api";
import { useAuth } from "../auth/useAuth";
import { Badge, Button, Card, FormField, InlineNotice, TextInput } from "../ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  // STATIC: child IDs that are allowed (empty = all)
  allowed_child_ids: number[];
  // ROTATING: ordered child IDs
  rotation_order: number[];
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
  allowed_child_ids: [],
  rotation_order: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatError(error: unknown): string {
  if (error instanceof ApiClientError) return error.detail;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function scheduleLabel(chore: Chore): string {
  switch (chore.schedule_mode) {
    case "NONE":      return "On-demand";
    case "ONCE":      return `Once (${chore.start_date})`;
    case "EVERY":     return `Every ${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""}`;
    case "AFTER_COMPLETION": return `${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""} after completion`;
    default:          return chore.schedule_mode;
  }
}

function eligibilityLabel(chore: Chore, children: Child[]): string {
  if (chore.assignment_mode === "ROTATING") {
    const names = chore.rotation_order
      .map((id) => children.find((c) => c.id === id)?.name ?? `#${id}`)
      .join(" → ");
    return `Rotation: ${names || "none set"}`;
  }
  if (chore.allowed_child_ids.length === 0) return "All children";
  const names = chore.allowed_child_ids
    .map((id) => children.find((c) => c.id === id)?.name ?? `#${id}`)
    .join(", ");
  return names;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ChildChecklistProps = {
  children: Child[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
};

function ChildChecklist({ children, selected, onChange, disabled }: ChildChecklistProps): ReactElement {
  function toggle(id: number): void {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {children.map((child) => (
        <label key={child.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: disabled ? "not-allowed" : "pointer" }}>
          <input
            type="checkbox"
            checked={selected.includes(child.id)}
            onChange={() => toggle(child.id)}
            disabled={disabled}
          />
          {child.name}
          {!child.active ? <span style={{ opacity: 0.5, fontSize: "0.8em" }}>(inactive)</span> : null}
        </label>
      ))}
      {children.length === 0 ? <p style={{ opacity: 0.6, margin: 0 }}>No children in household yet.</p> : null}
    </div>
  );
}

type RotationOrderProps = {
  children: Child[];
  order: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
};

function RotationOrderList({ children, order, onChange, disabled }: RotationOrderProps): ReactElement {
  function move(index: number, direction: -1 | 1): void {
    const next = [...order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }

  function toggleChild(id: number): void {
    if (order.includes(id)) {
      onChange(order.filter((x) => x !== id));
    } else {
      onChange([...order, id]);
    }
  }

  const inRotation = new Set(order);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85em" }}>
        Select children and drag or use ↑↓ to set rotation order.
      </p>

      {/* Selection toggles */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {children.map((child) => (
          <label key={child.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: disabled ? "not-allowed" : "pointer" }}>
            <input
              type="checkbox"
              checked={inRotation.has(child.id)}
              onChange={() => toggleChild(child.id)}
              disabled={disabled}
            />
            {child.name}
          </label>
        ))}
      </div>

      {/* Ordered list */}
      {order.length > 0 ? (
        <div style={{ marginTop: "0.5rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontWeight: 600, fontSize: "0.85em" }}>Rotation order:</p>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {order.map((id, idx) => {
              const name = children.find((c) => c.id === id)?.name ?? `#${id}`;
              return (
                <li key={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ flex: 1 }}>{name}</span>
                  <Button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0} style={{ padding: "0.1rem 0.4rem", fontSize: "0.8em" }}>↑</Button>
                  <Button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === order.length - 1} style={{ padding: "0.1rem 0.4rem", fontSize: "0.8em" }}>↓</Button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ParentChoresPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;

  const [state, setState] = useState<PageState>({ chores: [], loading: true, error: null });
  const [allChildren, setAllChildren] = useState<Child[]>([]);
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

  const loadChildren = useCallback(async (): Promise<void> => {
    if (householdId === null) return;
    try {
      const children = await apiClient.listChildren({ household_id: householdId });
      setAllChildren(children);
    } catch {
      // Non-fatal; child picker will just be empty
    }
  }, [householdId]);

  useEffect(() => {
    void loadChores();
    void loadChildren();
  }, [loadChores, loadChildren]);

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

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;

    const name = form.name.trim();
    if (name.length === 0) { setSubmitError("Chore name is required."); return; }

    const rewardCents = Math.round(parseFloat(form.reward_dollars) * 100);
    if (isNaN(rewardCents) || rewardCents < 0) { setSubmitError("Reward must be a non-negative number."); return; }

    const needsInterval = form.schedule_mode === "EVERY" || form.schedule_mode === "AFTER_COMPLETION";
    const scheduleInterval = needsInterval ? parseInt(form.schedule_interval, 10) : null;
    const scheduleUnit: ScheduleUnit | null = needsInterval ? form.schedule_unit : null;

    if (form.assignment_mode === "ROTATING" && form.rotation_order.length < 2) {
      setSubmitError("Rotation requires at least 2 children.");
      return;
    }

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
          allowed_child_ids: form.assignment_mode === "ROTATING" ? null : form.allowed_child_ids,
          rotation_order: form.assignment_mode === "ROTATING" ? form.rotation_order : null,
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
          allowed_child_ids: form.assignment_mode === "ROTATING" ? [] : form.allowed_child_ids,
          rotation_order: form.assignment_mode === "ROTATING" ? form.rotation_order : [],
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
      {/* Header */}
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Chores</h1>
          <Badge>Household {householdId ?? "Unknown"}</Badge>
        </div>
        <p>Create and manage chores. Set who can complete each one and rotation order.</p>
        {!showForm ? (
          <Button type="button" onClick={openCreateForm}>+ Add Chore</Button>
        ) : null}
      </Card>

      {/* Form */}
      {showForm ? (
        <Card className="dashboard-panel">
          <div className="panel-header-row">
            <h2>{editingId !== null ? "Edit Chore" : "New Chore"}</h2>
          </div>
          <form className="children-form" onSubmit={(e) => void handleSubmit(e)}>
            {/* Core fields */}
            <FormField label="Name">
              <TextInput type="text" value={form.name} onChange={(e) => setField("name", e.target.value)}
                placeholder="Take out trash" maxLength={255} disabled={submitting} />
            </FormField>

            <FormField label="Reward ($)">
              <TextInput type="number" value={form.reward_dollars}
                onChange={(e) => setField("reward_dollars", e.target.value)}
                placeholder="1.00" disabled={submitting} />
            </FormField>

            <FormField label="Start Date">
              <TextInput type="date" value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)} disabled={submitting} />
            </FormField>

            <FormField label="Schedule">
              <select value={form.schedule_mode}
                onChange={(e) => setField("schedule_mode", e.target.value as ScheduleMode)}
                disabled={submitting} className="text-input">
                <option value="NONE">On-demand</option>
                <option value="ONCE">Once</option>
                <option value="EVERY">Repeating (every N)</option>
                <option value="AFTER_COMPLETION">After completion</option>
              </select>
            </FormField>

            {showInterval ? (
              <FormField label="Interval">
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <TextInput type="number" value={form.schedule_interval}
                    onChange={(e) => setField("schedule_interval", e.target.value)}
                    placeholder="1" disabled={submitting} style={{ width: "5rem" }} />
                  <select value={form.schedule_unit}
                    onChange={(e) => setField("schedule_unit", e.target.value as ScheduleUnit)}
                    disabled={submitting} className="text-input">
                    <option value="DAY">Day(s)</option>
                    <option value="WEEK">Week(s)</option>
                    <option value="MONTH">Month(s)</option>
                  </select>
                </div>
              </FormField>
            ) : null}

            <FormField label="Completion">
              <select value={form.completion_mode}
                onChange={(e) => setField("completion_mode", e.target.value as CompletionMode)}
                disabled={submitting} className="text-input">
                <option value="PER_CHILD">Per child</option>
                <option value="SHARED">Shared (anyone can complete)</option>
              </select>
            </FormField>

            <FormField label="Assignment">
              <select value={form.assignment_mode}
                onChange={(e) => setField("assignment_mode", e.target.value as AssignmentMode)}
                disabled={submitting} className="text-input">
                <option value="STATIC">Static</option>
                <option value="ROTATING">Rotating</option>
              </select>
            </FormField>

            {/* Eligibility — use fieldset/legend to avoid outer <label> polluting checkbox names */}
            {form.assignment_mode === "ROTATING" ? (
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Rotation Order</legend>
                <RotationOrderList
                  children={allChildren}
                  order={form.rotation_order}
                  onChange={(ids) => setField("rotation_order", ids)}
                  disabled={submitting}
                />
              </fieldset>
            ) : (
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Who can complete? (empty = all)</legend>
                <ChildChecklist
                  children={allChildren}
                  selected={form.allowed_child_ids}
                  onChange={(ids) => setField("allowed_child_ids", ids)}
                  disabled={submitting}
                />
              </fieldset>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId !== null ? "Save Changes" : "Create Chore"}
              </Button>
              <Button type="button" onClick={cancelForm} disabled={submitting}>Cancel</Button>
            </div>

            {submitError !== null ? <InlineNotice variant="error">{submitError}</InlineNotice> : null}
          </form>
        </Card>
      ) : null}

      {/* Chore List */}
      <Card className="dashboard-panel">
        <div className="panel-header-row"><h2>All Chores</h2></div>

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
                        <span style={{ marginLeft: "0.5rem", opacity: 0.5, fontSize: "0.8em" }}>[archived]</span>
                      ) : null}
                    </p>
                    <p className="balance-meta">
                      ${chore.reward_dollars.toFixed(2)} · {scheduleLabel(chore)} · {chore.completion_mode}
                    </p>
                    <p className="balance-meta" style={{ fontSize: "0.8em", opacity: 0.75 }}>
                      👤 {eligibilityLabel(chore, allChildren)}
                    </p>
                  </div>
                  {chore.is_active ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button onClick={() => openEditForm(chore)} disabled={isArchiving}>Edit</Button>
                      <Button onClick={() => void handleArchive(chore)} disabled={isArchiving}>
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
