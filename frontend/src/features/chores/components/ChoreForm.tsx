import type { FormEvent, ReactElement } from "react";

import type { AssignmentMode, Child, CompletionMode, ScheduleMode, ScheduleUnit } from "../../../api";
import { Button, Card, DateInput, FormField, InlineNotice, TextInput } from "../../../ui";

export type ChoreFormState = {
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

type ChildChecklistProps = {
  children: Child[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
};

function ChildChecklist({ children, selected, onChange, disabled }: ChildChecklistProps): ReactElement {
  function toggle(id: number): void {
    onChange(selected.includes(id) ? selected.filter((childId) => childId !== id) : [...selected, id]);
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input type="checkbox" checked={selected.includes(child.id)} onChange={() => toggle(child.id)} disabled={disabled} />
          <span>{child.name}{!child.active ? <span className="muted-inline">inactive</span> : null}</span>
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

function RotationOrderList({ children, order, onChange, disabled }: RotationOrderProps): ReactElement {
  const inRotation = new Set(order);

  function move(index: number, direction: -1 | 1): void {
    const next = [...order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }

  function toggleChild(id: number): void {
    onChange(order.includes(id) ? order.filter((childId) => childId !== id) : [...order, id]);
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input type="checkbox" checked={inRotation.has(child.id)} onChange={() => toggleChild(child.id)} disabled={disabled} />
          {child.name}
        </label>
      ))}

      {order.length > 0 ? (
        <ol className="rotation-order-list" aria-label="Rotation order">
          {order.map((id, index) => {
            const name = children.find((child) => child.id === id)?.name ?? `#${id}`;
            return (
              <li key={id}>
                <span>{name}</span>
                <div className="item-actions">
                  <Button type="button" onClick={() => move(index, -1)} disabled={disabled || index === 0}>Up</Button>
                  <Button type="button" onClick={() => move(index, 1)} disabled={disabled || index === order.length - 1}>Down</Button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

type ChoreFormProps = {
  children: Child[];
  editingId: number | null;
  form: ChoreFormState;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setField: <K extends keyof ChoreFormState>(key: K, value: ChoreFormState[K]) => void;
  showInterval: boolean;
  submitError: string | null;
  submitting: boolean;
};

export function ChoreForm({ children, editingId, form, onCancel, onSubmit, setField, showInterval, submitError, submitting }: ChoreFormProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row"><h2>{editingId !== null ? "Edit Chore" : "New Chore"}</h2></div>
      <form className="children-form chore-management-form" onSubmit={onSubmit}>
        <FormField label="Name">
          <TextInput type="text" value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Take out trash" maxLength={255} disabled={submitting} />
        </FormField>
        <FormField label="Start Date"><DateInput value={form.start_date} onChange={(event) => setField("start_date", event.target.value)} disabled={submitting} /></FormField>
        <FormField label="Global End Date"><DateInput value={form.expires_at} onChange={(event) => setField("expires_at", event.target.value)} disabled={submitting} /></FormField>
        <FormField label="Completion Window Days"><TextInput type="number" min="1" value={form.timeout_days} onChange={(event) => setField("timeout_days", event.target.value)} disabled={submitting} /></FormField>
        <FormField label="Schedule">
          <select value={form.schedule_mode} onChange={(event) => setField("schedule_mode", event.target.value as ScheduleMode)} disabled={submitting} className="text-input">
            <option value="NONE">On-demand</option><option value="ONCE">Once</option><option value="EVERY">Repeating</option><option value="AFTER_COMPLETION">After completion</option>
          </select>
        </FormField>
        {showInterval ? (
          <FormField label="Interval">
            <div className="inline-field-row">
              <TextInput type="number" min="1" value={form.schedule_interval} onChange={(event) => setField("schedule_interval", event.target.value)} disabled={submitting} />
              <select value={form.schedule_unit} onChange={(event) => setField("schedule_unit", event.target.value as ScheduleUnit)} disabled={submitting} className="text-input">
                <option value="DAY">Day(s)</option><option value="WEEK">Week(s)</option><option value="MONTH">Month(s)</option>
              </select>
            </div>
          </FormField>
        ) : null}
        <FormField label="Completion">
          <select value={form.completion_mode} onChange={(event) => setField("completion_mode", event.target.value as CompletionMode)} disabled={submitting} className="text-input">
            <option value="PER_CHILD">Per child</option><option value="SHARED">Shared</option>
          </select>
        </FormField>
        <FormField label="Assignment">
          <select value={form.assignment_mode} onChange={(event) => setField("assignment_mode", event.target.value as AssignmentMode)} disabled={submitting} className="text-input">
            <option value="STATIC">Static</option><option value="ROTATING">Rotating</option>
          </select>
        </FormField>
        {form.assignment_mode === "ROTATING" ? (
          <fieldset className="plain-fieldset"><legend>Rotation Order</legend><RotationOrderList children={children} order={form.rotation_order} onChange={(ids) => setField("rotation_order", ids)} disabled={submitting} /></fieldset>
        ) : (
          <fieldset className="plain-fieldset"><legend>Who can complete? Empty means all children.</legend><ChildChecklist children={children} selected={form.allowed_child_ids} onChange={(ids) => setField("allowed_child_ids", ids)} disabled={submitting} /></fieldset>
        )}
        <div className="quick-actions">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingId !== null ? "Save Changes" : "Create Chore"}</Button>
          <Button type="button" onClick={onCancel} disabled={submitting}>Cancel</Button>
        </div>
        {submitError !== null ? <InlineNotice variant="error">{submitError}</InlineNotice> : null}
      </form>
    </Card>
  );
}
