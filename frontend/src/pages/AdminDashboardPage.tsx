import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { CreateParentPanel } from "../features/admin/components/CreateParentPanel";
import { HouseholdModulesPanel } from "../features/admin/components/HouseholdModulesPanel";
import { UserModuleAccessPanel } from "../features/admin/components/UserModuleAccessPanel";
import { useAdminUsers } from "../features/admin/hooks/useAdminUsers";
import { useHouseholdModules } from "../features/admin/hooks/useHouseholdModules";
import { familyModules } from "../modules/registry";
import { ButtonLink, Card } from "../ui";

export function AdminDashboardPage(): ReactElement {
  const { refreshModuleAccess } = useAuth();
  const userManagement = useAdminUsers();
  const householdManagement = useHouseholdModules({
    refreshModuleAccess,
    refreshUsers: userManagement.loadUsers,
  });

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
          Manage household-wide Family Manager module access from one place.
        </p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Manage Children</ButtonLink>
          <ButtonLink to="/chore/account/security">Account Security</ButtonLink>
        </div>
      </Card>

      <CreateParentPanel
        createParent={userManagement.createParent}
        creating={userManagement.creatingParent}
        email={userManagement.newParentEmail}
        password={userManagement.newParentPassword}
        role={userManagement.newParentRole}
        setEmail={userManagement.setNewParentEmail}
        setPassword={userManagement.setNewParentPassword}
        setRole={userManagement.setNewParentRole}
      />

      <HouseholdModulesPanel
        actionError={householdManagement.actionError}
        actionMessage={householdManagement.actionMessage}
        error={householdManagement.error}
        loading={householdManagement.loading}
        modules={householdManagement.modules}
        onRetry={householdManagement.loadModules}
        onToggle={householdManagement.toggleModule}
        pendingKey={householdManagement.pendingKey}
      />

      <UserModuleAccessPanel
        actionError={userManagement.actionError}
        actionMessage={userManagement.actionMessage}
        error={userManagement.error}
        householdError={householdManagement.error}
        householdLoading={householdManagement.loading}
        householdModules={householdManagement.modules}
        loading={userManagement.loading}
        onToggle={userManagement.toggleAccess}
        users={userManagement.users}
      />

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
