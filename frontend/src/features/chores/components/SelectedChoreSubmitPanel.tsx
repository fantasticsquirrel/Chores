import type { ReactElement } from "react";

import type { Child } from "../../../api";
import { Badge, Button, Card, FormField, InlineNotice } from "../../../ui";
import type { EligibleChildState } from "../hooks/useEligibleChores";

type SelectedChoreSubmitPanelProps = {
  activeChildren: Child[];
  onChildChange: (childId: string) => void;
  onRefresh: () => void;
  onSubmit: () => void;
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
  return (
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
                  onChange={() => onToggleChore(chore.chore_id)}
                  disabled={submitting}
                />
                <span>
                  <span className="balance-name">{chore.name}</span>
                  <span className="balance-meta">
                    Due {chore.occurrence_date}
                    {chore.expires_on !== null && chore.expires_on !== undefined
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
          onClick={onSubmit}
          disabled={
            submitting ||
            selectedChild === null ||
            selectedChoreIds.length === 0
          }
        >
          {submitting ? "Submitting..." : "Submit Selected Chores"}
        </Button>
      </div>
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
