import type { ReactElement } from "react";

import { familyModules } from "../modules/registry";
import { ButtonLink, Card } from "../ui";

export function AdminDashboardPage(): ReactElement {
  return (
    <section className="dashboard-grid" aria-label="Admin dashboard">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Family Manager</p>
            <h1>Admin Dashboard</h1>
          </div>
        </div>
        <p>
          This is the starting point for household-wide module access management. The next backend slice will persist
          per-user and per-household access instead of using role defaults.
        </p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Manage Children</ButtonLink>
          <ButtonLink to="/chore/account/security">Account Security</ButtonLink>
        </div>
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
