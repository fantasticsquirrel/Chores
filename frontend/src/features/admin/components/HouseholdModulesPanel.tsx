import type { ReactElement } from "react";

import type { HouseholdModuleAccess } from "../../../api";
import type { FamilyModuleKey } from "../../../modules/registry";
import { Button, Card, InlineNotice } from "../../../ui";

type HouseholdModulesPanelProps = {
  actionError: string | null;
  actionMessage: string | null;
  error: string | null;
  loading: boolean;
  modules: HouseholdModuleAccess[];
  onRetry: () => void;
  onToggle: (module: HouseholdModuleAccess) => Promise<void>;
  pendingKey: FamilyModuleKey | null;
};

export function HouseholdModulesPanel({
  actionError,
  actionMessage,
  error,
  loading,
  modules,
  onRetry,
  onToggle,
  pendingKey,
}: HouseholdModulesPanelProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <h2>Household Module Toggles</h2>
      <p>
        These controls affect everyone in the household. Per-user access can
        still be limited below.
      </p>
      {loading ? (
        <p role="status">Loading household module toggles...</p>
      ) : null}
      {error !== null ? (
        <>
          <InlineNotice variant="error">
            Could not load household module toggles: {error}
          </InlineNotice>
          <Button type="button" onClick={onRetry}>
            Retry household modules
          </Button>
        </>
      ) : null}
      {actionError !== null ? (
        <InlineNotice variant="error">
          Could not update household module: {actionError}
        </InlineNotice>
      ) : null}
      {actionMessage !== null ? (
        <p role="status" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}
      {!loading && error === null ? (
        <ul className="balance-list" aria-label="Household module toggles">
          {modules.map((module) => {
            const locked = !module.can_disable;
            const pending = pendingKey !== null;
            return (
              <li key={module.key} className="balance-item">
                <div>
                  <p className="balance-name">{module.name}</p>
                  <p className="balance-meta">{module.description}</p>
                  {locked ? (
                    <p className="balance-meta">
                      Required for household administration; it cannot be
                      disabled.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={`${module.name} household module`}
                  aria-checked={module.enabled}
                  disabled={locked || pending}
                  className={`jewel-button button-reset${module.enabled ? "" : " danger-button"}`}
                  onClick={() => void onToggle(module)}
                >
                  {pendingKey === module.key
                    ? "Saving…"
                    : module.enabled
                      ? "On"
                      : "Off"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
