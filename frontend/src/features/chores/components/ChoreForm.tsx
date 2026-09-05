import type { FormEvent, ReactElement } from "react";

import type { Child, ScheduleMode, ScheduleUnit } from "../../../api";
import {
  Button,
  Card,
  DateInput,
  FormField,
  InlineNotice,
  TextInput,
} from "../../../ui";
import type { ChoreFormState } from "../lib/choreForm";
import { ChoreAssignmentFields } from "./ChoreAssignmentFields";

export type { ChoreFormState } from "../lib/choreForm";

type ChoreFormProps = {
  children: Child[];
  editingId: number | null;
  form: ChoreFormState;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setField: <K extends keyof ChoreFormState>(
    key: K,
    value: ChoreFormState[K],
  ) => void;
  showInterval: boolean;
  submitError: string | null;
  submitting: boolean;
};

export function ChoreForm({
  children,
  editingId,
  form,
  onCancel,
  onSubmit,
  setField,
  showInterval,
  submitError,
  submitting,
}: ChoreFormProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>{editingId !== null ? "Edit Chore" : "New Chore"}</h2>
      </div>
      <form className="children-form chore-management-form" onSubmit={onSubmit}>
        <FormField label="Used by">
          <select
            value={form.task_scope}
            onChange={(event) =>
              setField("task_scope", event.target.value as "CHILD" | "PARENT")
            }
            disabled={submitting || editingId !== null}
            className="text-input"
          >
            <option value="CHILD">Children (reward/allowance)</option>
            <option value="PARENT">My account (money-free to-do)</option>
          </select>
        </FormField>
        <FormField label="Name">
          <TextInput
            type="text"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Take out trash"
            maxLength={255}
            disabled={submitting}
          />
        </FormField>
        {form.task_scope === "CHILD" ? (
          <FormField label="Reward ($)">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={form.reward_dollars}
              onChange={(event) =>
                setField("reward_dollars", event.target.value)
              }
              disabled={submitting}
            />
          </FormField>
        ) : (
          <InlineNotice variant="info">
            Parent chores are recurring personal to-dos and never affect a child
            balance.
          </InlineNotice>
        )}
        <FormField label="Start Date">
          <DateInput
            value={form.start_date}
            onChange={(event) => setField("start_date", event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="Global End Date">
          <DateInput
            value={form.expires_at}
            onChange={(event) => setField("expires_at", event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="Completion Window Days">
          <TextInput
            type="number"
            min="1"
            value={form.timeout_days}
            onChange={(event) => setField("timeout_days", event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="Schedule">
          <select
            value={form.schedule_mode}
            onChange={(event) =>
              setField("schedule_mode", event.target.value as ScheduleMode)
            }
            disabled={submitting}
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
                disabled={submitting}
              />
              <select
                value={form.schedule_unit}
                onChange={(event) =>
                  setField("schedule_unit", event.target.value as ScheduleUnit)
                }
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
        <ChoreAssignmentFields
          allowedChildIds={form.allowed_child_ids}
          assignmentMode={form.assignment_mode}
          children={children}
          completionMode={form.completion_mode}
          disabled={submitting}
          onAllowedChildIdsChange={(ids) => setField("allowed_child_ids", ids)}
          onAssignmentModeChange={(mode) => setField("assignment_mode", mode)}
          onCompletionModeChange={(mode) => setField("completion_mode", mode)}
          onRotationOrderChange={(ids) => setField("rotation_order", ids)}
          rotationOrder={form.rotation_order}
          taskScope={form.task_scope}
        />
        <div className="quick-actions">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving..."
              : editingId !== null
                ? "Save Changes"
                : "Create Chore"}
          </Button>
          <Button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
        {submitError !== null ? (
          <InlineNotice variant="error">{submitError}</InlineNotice>
        ) : null}
      </form>
    </Card>
  );
}
