import { useState, type ReactElement } from "react";

import type { Child, EligibleChore } from "../../../api";
import { Badge, Button, Card, FormField, InlineNotice } from "../../../ui";
import type { EligibleChildState } from "../hooks/useEligibleChores";

type SelectedChoreSubmitPanelProps = {
  activeChildren: Child[];
  onChildChange: (childId: string) => void;
  onRefresh: () => void;
  onSubmit: () => void;
  onQuickSubmit: (child: Child, chore: EligibleChore) => void;
  onToggleChore: (choreId: number) => void;
  selectedChild: Child | null;
  selectedChildId: string;
  selectedChoreIds: number[];
  selectedEligibleState: EligibleChildState;
  submitError: string | null;
  submitSuccess: string | null;
  submitting: boolean;
  targetDate: string;
};

export function SelectedChoreSubmitPanel({
  activeChildren,
  onChildChange,
  onRefresh,
  onSubmit,
  onQuickSubmit,
  onToggleChore,
  selectedChild,
  selectedChildId,
  selectedChoreIds,
  selectedEligibleState,
  submitError,
  submitSuccess,
  submitting,
  targetDate,
}: SelectedChoreSubmitPanelProps): ReactElement {
  const [multiple, setMultiple] = useState(false);
  const busy =
    submitting ||
    selectedEligibleState.loading ||
    selectedEligibleState.submittingChoreId !== null;
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>
          {selectedChild
            ? `${selectedChild.name}’s chores`
            : "Available chores"}
        </h2>
        <Badge>{selectedChoreIds.length} selected</Badge>
      </div>
      <form
        className="children-form today-controls"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField label="Child">
          <select
            className="text-input"
            disabled={busy}
            value={selectedChildId}
            onChange={(event) => onChildChange(event.target.value)}
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
          onClick={onRefresh}
          disabled={
            busy || selectedChild === null || selectedEligibleState.loading
          }
        >
          Refresh
        </Button>
      </form>

      <Button
        type="button"
        aria-pressed={multiple}
        disabled={busy}
        onClick={() => setMultiple(!multiple)}
      >
        {multiple ? "Quick submit mode" : "Select multiple"}
      </Button>
      {selectedEligibleState.message ? (
        <InlineNotice variant="success">
          {selectedEligibleState.message}
        </InlineNotice>
      ) : null}
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
              {multiple ? (
                <label className="checkbox-row task-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedChoreIds.includes(chore.chore_id)}
                    onChange={() => onToggleChore(chore.chore_id)}
                    disabled={busy}
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
              ) : (
                <Button
                  type="button"
                  className="chore-submit-button"
                  disabled={busy}
                  onClick={() => onQuickSubmit(selectedChild, chore)}
                >
                  <span>{chore.name}</span>
                  <small>
                    Due {chore.occurrence_date}
                    {chore.expires_on ? ` · Ends ${chore.expires_on}` : ""}
                  </small>
                  <strong>
                    {selectedEligibleState.submittingChoreId === chore.chore_id
                      ? "Submitting..."
                      : "Submit"}
                  </strong>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {multiple ? (
        <div className="quick-actions">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              busy || selectedChild === null || selectedChoreIds.length === 0
            }
          >
            {submitting ? "Submitting..." : "Submit Selected Chores"}
          </Button>
        </div>
      ) : null}
      {submitError !== null ? (
        <InlineNotice variant="error">
          Could not submit chores: {submitError}
        </InlineNotice>
      ) : null}
      {submitSuccess !== null ? (
        <InlineNotice variant="success">{submitSuccess}</InlineNotice>
      ) : null}
    </Card>
  );
}
