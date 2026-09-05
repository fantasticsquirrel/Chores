import type { ReactElement } from "react";

import type { HouseholdModuleAccess, UserModuleAccess } from "../../../api";
import {
  familyModules,
  type FamilyModuleKey,
} from "../../../modules/registry";
import { Card, InlineNotice } from "../../../ui";
import { hasModule, isLastAdminAccess } from "../lib/moduleAccess";

type UserModuleAccessPanelProps = {
  actionError: string | null;
  actionMessage: string | null;
  error: string | null;
  householdError: string | null;
  householdLoading: boolean;
  householdModules: HouseholdModuleAccess[];
  loading: boolean;
  onToggle: (
    user: UserModuleAccess,
    moduleKey: FamilyModuleKey,
  ) => Promise<void>;
  users: UserModuleAccess[];
};

export function UserModuleAccessPanel({
  actionError,
  actionMessage,
  error,
  householdError,
  householdLoading,
  householdModules,
  loading,
  onToggle,
  users,
}: UserModuleAccessPanelProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <h2>Module Access Matrix</h2>
      {loading ? <p>Loading module access...</p> : null}
      {error !== null ? (
        <InlineNotice variant="error">
          Could not load module access: {error}
        </InlineNotice>
      ) : null}
      {actionError !== null ? (
        <InlineNotice variant="error">
          Could not update module access: {actionError}
        </InlineNotice>
      ) : null}
      {actionMessage !== null ? (
        <InlineNotice>{actionMessage}</InlineNotice>
      ) : null}

      {!loading && error === null ? (
        <ul className="balance-list" aria-label="User module access list">
          {users.map((user) => (
            <li
              key={user.id}
              className="balance-item"
              style={{ alignItems: "flex-start" }}
            >
              <div>
                <p className="balance-name">{user.email}</p>
                <p className="balance-meta">
                  {user.role}
                  {user.child_id ? ` · child ${user.child_id}` : ""}
                </p>
              </div>
              <div
                className="quick-actions"
                aria-label={`Module access for ${user.email}`}
              >
                {familyModules.map((module) => {
                  const enabled = hasModule(user, module.key);
                  const householdStateUnavailable =
                    householdLoading || householdError !== null;
                  const globallyDisabled = householdModules.some(
                    (row) => row.key === module.key && !row.enabled,
                  );
                  const disabled =
                    householdStateUnavailable ||
                    globallyDisabled ||
                    isLastAdminAccess(users, user, module.key);
                  return (
                    <button
                      key={module.key}
                      type="button"
                      className={`jewel-button button-reset${enabled ? "" : " danger-button"}`}
                      disabled={disabled}
                      title={
                        householdStateUnavailable
                          ? "Household module state is unavailable; retry before changing user access."
                          : globallyDisabled
                            ? "This module is disabled for the whole household."
                            : disabled
                              ? "At least one admin must keep Admin access."
                              : undefined
                      }
                      onClick={() => void onToggle(user, module.key)}
                    >
                      {householdStateUnavailable
                        ? "Household state unavailable"
                        : globallyDisabled
                          ? "Globally off"
                          : enabled
                            ? "✓"
                            : "—"}{" "}
                      {module.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
