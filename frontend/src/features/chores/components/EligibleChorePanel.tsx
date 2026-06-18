import type { ReactElement } from "react";

import type { Child, EligibleChore } from "../../../api";
import { Badge, Button, Card, InlineNotice } from "../../../ui";

type EligibleChildState = {
  chores: EligibleChore[];
  loading: boolean;
  error: string | null;
  message: string | null;
  submittingChoreId: number | null;
};

type EligibleChorePanelProps = {
  child: Child;
  state: EligibleChildState;
  onQuickSubmit: (child: Child, chore: EligibleChore) => void;
};

export function EligibleChorePanel({ child, state, onQuickSubmit }: EligibleChorePanelProps): ReactElement {
  return (
    <Card className="parent-child-chore-card">
      <div className="panel-header-row">
        <h3>{child.name}</h3>
        <Badge>{state.chores.length} available</Badge>
      </div>
      {state.loading ? <p>Loading chores...</p> : null}
      {state.error !== null ? (
        <InlineNotice variant="error">Could not load chores: {state.error}</InlineNotice>
      ) : null}
      {!state.loading && state.error === null && state.chores.length === 0 ? <p>No chores available for this date.</p> : null}
      {!state.loading && state.error === null && state.chores.length > 0 ? (
        <div className="chore-button-list" aria-label={`${child.name} available chores`}>
          {state.chores.map((chore) => (
            <Button
              key={chore.chore_id}
              type="button"
              className="chore-submit-button"
              onClick={() => onQuickSubmit(child, chore)}
              disabled={state.submittingChoreId !== null}
            >
              <span>{chore.name}</span>
              {chore.expires_on !== null && chore.expires_on !== undefined ? <small>Ends {chore.expires_on}</small> : null}
              <strong>{state.submittingChoreId === chore.chore_id ? "Submitting..." : "Submit"}</strong>
            </Button>
          ))}
        </div>
      ) : null}
      {state.message !== null ? <InlineNotice variant="success">{state.message}</InlineNotice> : null}
    </Card>
  );
}
