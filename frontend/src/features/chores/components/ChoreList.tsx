import type { ReactElement } from "react";

import type { Child, Chore } from "../../../api";
import { Button, Card, InlineNotice } from "../../../ui";
import { buildTimingLabel, completionLabel, eligibilityLabel, scheduleLabel } from "../lib/choreLabels";

type ChoresState = {
  chores: Chore[];
  loading: boolean;
  error: string | null;
};

type ChoreListProps = {
  archivingId: number | null;
  children: Child[];
  choresState: ChoresState;
  onArchive: (chore: Chore) => void;
  onCreate: () => void;
  onEdit: (chore: Chore) => void;
  showForm: boolean;
};

export function ChoreList({ archivingId, children, choresState, onArchive, onCreate, onEdit, showForm }: ChoreListProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>All Chores</h2>
        {!showForm ? <Button type="button" onClick={onCreate}>Add Chore</Button> : null}
      </div>

      {choresState.loading ? <p>Loading chores...</p> : null}
      {!choresState.loading && choresState.error !== null ? (
        <InlineNotice variant="error">Could not load chores: {choresState.error}</InlineNotice>
      ) : null}
      {!choresState.loading && choresState.error === null && choresState.chores.length === 0 ? (
        <p>No chores yet. Add one above to get started.</p>
      ) : null}

      {!choresState.loading && choresState.error === null && choresState.chores.length > 0 ? (
        <ul className="balance-list" aria-label="Chores list">
          {choresState.chores.map((chore) => {
            const isArchiving = archivingId === chore.id;
            const timingLabel = buildTimingLabel(chore);
            return (
              <li key={chore.id} className="balance-item">
                <div>
                  <p className="balance-name">
                    {chore.name}
                    {!chore.is_active ? <span className="muted-inline">archived</span> : null}
                  </p>
                  <p className="balance-meta">{scheduleLabel(chore)} - {completionLabel(chore.completion_mode)}</p>
                  {timingLabel.length > 0 ? <p className="balance-meta">{timingLabel}</p> : null}
                  <p className="balance-meta">Assigned: {eligibilityLabel(chore, children)}</p>
                </div>
                {chore.is_active ? (
                  <div className="item-actions">
                    <Button type="button" onClick={() => onEdit(chore)} disabled={isArchiving}>Edit</Button>
                    <Button type="button" onClick={() => onArchive(chore)} disabled={isArchiving}>
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
  );
}
