import { useEffect, useRef, useState, type ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { CreateParentPanel } from "../features/admin/components/CreateParentPanel";
import { HouseholdModulesPanel } from "../features/admin/components/HouseholdModulesPanel";
import { UserModuleAccessPanel } from "../features/admin/components/UserModuleAccessPanel";
import { useAdminUsers } from "../features/admin/hooks/useAdminUsers";
import { useHouseholdModules } from "../features/admin/hooks/useHouseholdModules";
import { Button, ButtonLink, Card } from "../ui";

export function AdminDashboardPage(): ReactElement {
  const [addingParent, setAddingParent] = useState(false);
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  const { refreshModuleAccess } = useAuth();
  const userManagement = useAdminUsers();
  const householdManagement = useHouseholdModules({
    refreshModuleAccess,
    refreshUsers: userManagement.loadUsers,
  });

  function closeParent() {
    setAddingParent(false);
    addTrigger.current?.focus();
  }
  useEffect(() => {
    if (userManagement.actionMessage?.startsWith("Created ")) {
      setAddingParent(false);
      addTrigger.current?.focus();
    }
  }, [userManagement.actionMessage]);

  return (
    <section className="dashboard-grid" aria-label="Admin dashboard">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h1>Admin Dashboard</h1>
          </div>
        </div>
        <p>Manage household modules and account access.</p>
        <div className="quick-actions">
          <Button aria-expanded={addingParent} onClick={(event) => { addTrigger.current = event.currentTarget; setAddingParent(true); }}>Add Parent</Button>
          <ButtonLink variant="secondary" to="/parent/children">Manage Children</ButtonLink>
          <ButtonLink variant="secondary" to="/chore/account/security">Account Security</ButtonLink>
        </div>
      </Card>

      {addingParent ? <CreateParentPanel
        onClose={closeParent}
        error={userManagement.actionError}
        createParent={userManagement.createParent}
        creating={userManagement.creatingParent}
        email={userManagement.newParentEmail}
        password={userManagement.newParentPassword}
        role={userManagement.newParentRole}
        setEmail={userManagement.setNewParentEmail}
        setPassword={userManagement.setNewParentPassword}
        setRole={userManagement.setNewParentRole}
      /> : null}

      <div hidden={addingParent} style={addingParent ? { display: "none" } : undefined} className="dashboard-grid">

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

      </div>
    </section>
  );
}
