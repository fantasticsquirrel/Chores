import type { ReactElement } from "react";

import type { Child } from "../../../api";
import { Button, Card, InlineNotice } from "../../../ui";
import type { ChildrenState } from "../hooks/useChildren";

type ChildrenListPanelProps = {
  onSelect?: (child: Child) => void;
  selectedChildId?: number | null;
  onToggleActive: (child: Child) => void;
  state: ChildrenState;
  updatingChildId: number | null;
};

export function ChildrenListPanel({
  onSelect,
  selectedChildId,
  onToggleActive,
  state,
  updatingChildId,
}: ChildrenListPanelProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>Children</h2>
      </div>

      {state.loading ? <p>Loading children...</p> : null}
      {!state.loading && state.error !== null ? (
        <InlineNotice variant="error">
          Could not load children: {state.error}
        </InlineNotice>
      ) : null}

      {!state.loading && state.error === null && state.children.length === 0 ? (
        <p>No children found yet for this household.</p>
      ) : null}

      {!state.loading && state.error === null && state.children.length > 0 ? (
        <ul className="balance-list children-roster" aria-label="Children list">
          {state.children.map((child) => {
            const isUpdating = updatingChildId === child.id;
            const buttonLabel = child.active ? "Set Inactive" : "Set Active";

            return (
              <li key={child.id} className="balance-item">
                <div>
                  <p className="balance-name">{child.name}</p>
                  <p className="balance-meta">
                    {child.active ? "Active" : "Inactive"}
                  </p>
                  <p className="balance-meta">
                    {child.has_login === true
                      ? "Login linked"
                      : child.has_login === false
                        ? "No login linked"
                        : "Login status unavailable"}
                  </p>
                </div>
                <div className="item-actions">
                  {onSelect ? (
                    <Button
                      type="button"
                      aria-pressed={selectedChildId === child.id}
                      onClick={() => onSelect(child)}
                    >
                      Manage login for {child.name}
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => onToggleActive(child)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Updating..." : buttonLabel}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
