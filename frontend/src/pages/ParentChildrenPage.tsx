import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { AddChildPanel } from "../features/children/components/AddChildPanel";
import { ChildAccountPanels } from "../features/children/components/ChildAccountPanels";
import { ChildrenListPanel } from "../features/children/components/ChildrenListPanel";
import { useChildAccountActions } from "../features/children/hooks/useChildAccountActions";
import { useChildMutations } from "../features/children/hooks/useChildMutations";
import { useChildren } from "../features/children/hooks/useChildren";
import { Badge, Card } from "../ui";

export function ParentChildrenPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const children = useChildren(householdId);
  const mutations = useChildMutations({
    householdId,
    loadChildren: children.loadChildren,
  });
  const accountActions = useChildAccountActions({
    children: children.state.children,
    householdId,
    selectedChildId: children.selectedChildId,
  });

  return (
    <section className="dashboard-grid" aria-label="Parent children management">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Children Management</h1>
          <Badge>Household {householdId ?? "Unknown"}</Badge>
        </div>
        <p>
          Create child profiles and manage child login accounts. Children can
          sign in with a parent login email, their child name, and child
          password. Optional legacy login emails still work for email/password
          sign-in.
        </p>
      </Card>

      <AddChildPanel mutations={mutations} />

      <ChildAccountPanels
        actions={accountActions}
        children={children.state.children}
        onSelectedChildIdChange={children.setSelectedChildId}
        selectedChildId={children.selectedChildId}
      />

      <ChildrenListPanel
        onToggleActive={(child) => void mutations.toggleActive(child)}
        state={children.state}
        updatingChildId={mutations.updatingChildId}
      />
    </section>
  );
}
