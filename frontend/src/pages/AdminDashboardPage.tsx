import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient, ApiClientError, type UserModuleAccess } from "../api";
import { familyModules, type FamilyModuleKey } from "../modules/registry";
import { ButtonLink, Card, InlineNotice } from "../ui";

type AdminState = {
  users: UserModuleAccess[];
  loading: boolean;
  error: string | null;
};

function formatLoadError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}

function hasModule(user: UserModuleAccess, moduleKey: FamilyModuleKey): boolean {
  return user.modules.some((module) => module.key === moduleKey);
}

function isLastAdminAccess(users: UserModuleAccess[], user: UserModuleAccess, moduleKey: FamilyModuleKey): boolean {
  if (moduleKey !== "admin" || !hasModule(user, "admin")) {
    return false;
  }
  return users.filter((row) => row.role === "PARENT_ADMIN" && hasModule(row, "admin")).length === 1;
}

export function AdminDashboardPage(): ReactElement {
  const [state, setState] = useState<AdminState>({ users: [], loading: true, error: null });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  function refresh(): void {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    apiClient
      .listUserModuleAccess()
      .then((users) => setState({ users, loading: false, error: null }))
      .catch((error: unknown) => setState({ users: [], loading: false, error: formatLoadError(error) }));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleAccess(user: UserModuleAccess, moduleKey: FamilyModuleKey): Promise<void> {
    setActionError(null);
    setActionMessage(null);
    const nextCanView = !hasModule(user, moduleKey);
    try {
      const updated = await apiClient.setUserModuleAccess(user.id, {
        module_key: moduleKey,
        can_view: nextCanView,
        can_manage: moduleKey === "admin" && nextCanView,
      });
      setState((prev) => ({
        ...prev,
        users: prev.users.map((row) => (row.id === updated.id ? updated : row)),
      }));
      setActionMessage(`${updated.email} ${nextCanView ? "can now access" : "lost access to"} ${moduleKey}.`);
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  return (
    <section className="dashboard-grid" aria-label="Admin dashboard">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Family Manager</p>
            <h1>Admin Dashboard</h1>
          </div>
        </div>
        <p>Manage household-wide Family Manager module access from one place.</p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Manage Children</ButtonLink>
          <ButtonLink to="/chore/account/security">Account Security</ButtonLink>
        </div>
      </Card>

      <Card className="dashboard-panel">
        <h2>Module Access Matrix</h2>
        {state.loading ? <p>Loading module access...</p> : null}
        {state.error !== null ? <InlineNotice variant="error">Could not load module access: {state.error}</InlineNotice> : null}
        {actionError !== null ? <InlineNotice variant="error">Could not update module access: {actionError}</InlineNotice> : null}
        {actionMessage !== null ? <InlineNotice>{actionMessage}</InlineNotice> : null}

        {!state.loading && state.error === null ? (
          <ul className="balance-list" aria-label="User module access list">
            {state.users.map((user) => (
              <li key={user.id} className="balance-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <p className="balance-name">{user.email}</p>
                  <p className="balance-meta">{user.role}{user.child_id ? ` · child ${user.child_id}` : ""}</p>
                </div>
                <div className="quick-actions" aria-label={`Module access for ${user.email}`}>
                  {familyModules.map((module) => {
                    const enabled = hasModule(user, module.key);
                    const disabled = isLastAdminAccess(state.users, user, module.key);
                    return (
                      <button
                        key={module.key}
                        type="button"
                        className={`jewel-button button-reset${enabled ? "" : " danger-button"}`}
                        disabled={disabled}
                        title={disabled ? "At least one admin must keep Admin access." : undefined}
                        onClick={() => void toggleAccess(user, module.key)}
                      >
                        {enabled ? "✓" : "—"} {module.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="dashboard-panel">
        <h2>Default Modules</h2>
        <ul className="balance-list">
          {familyModules.map((module) => (
            <li key={module.key} className="balance-item">
              <div>
                <p className="balance-name">{module.label}</p>
                <p className="balance-meta">{module.description}</p>
              </div>
              <div className="balance-pill">{module.roles.join(", ")}</div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
