import { useState, type ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { AddChildPanel } from "../features/children/components/AddChildPanel";
import { ChildAccountDialog } from "../features/children/components/ChildAccountDialog";
import { ChildAccountPanels } from "../features/children/components/ChildAccountPanels";
import { ChildrenListPanel } from "../features/children/components/ChildrenListPanel";
import { useChildAccountActions } from "../features/children/hooks/useChildAccountActions";
import { useChildMutations } from "../features/children/hooks/useChildMutations";
import { useChildren } from "../features/children/hooks/useChildren";
import { Badge, Button, Card, InlineNotice } from "../ui";

export function ParentChildrenPage(): ReactElement {
  const { user, manageableModuleKeys } = useAuth();
  const canManage = manageableModuleKeys.includes("chores");
  const householdId = user?.household_id ?? null;
  const children = useChildren(householdId);
  const mutations = useChildMutations({
    canManage,
    householdId,
    loadChildren: children.loadChildren,
  });
  const [adding, setAdding] = useState(false);
  const [accountChildId, setAccountChildId] = useState<number | null>(null);

  return (
    <section className="dashboard-grid" aria-label="Parent children management">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h1>Children Management</h1>
          <Badge>{children.state.children.length} children</Badge>
          <Button type="button" onClick={() => setAdding(!adding)}>
            {adding ? "Close Add Child" : "Add Child"}
          </Button>
        </div>
      </Card>
      {adding ? <AddChildPanel mutations={mutations} /> : null}
      {!adding && mutations.submitError ? (
        <InlineNotice variant="error" style={{ gridColumn: "1 / -1" }}>
          Could not save child: {mutations.submitError}
        </InlineNotice>
      ) : null}

      <ChildrenListPanel
        selectedChildId={accountChildId}
        onSelect={(child) =>
          setAccountChildId((current) =>
            current === child.id ? null : child.id,
          )
        }
        onToggleActive={(child) => void mutations.toggleActive(child)}
        state={children.state}
        updatingChildId={mutations.updatingChildId}
      />
      {canManage && accountChildId !== null ? (
        <ChildAccountDialog onClose={() => setAccountChildId(null)}>
          <SelectedChildAccount
            key={accountChildId}
            householdId={householdId}
            children={children.state.children}
            childId={accountChildId}
            onAccountChanged={children.loadChildren}
          />
        </ChildAccountDialog>
      ) : null}
    </section>
  );
}

function SelectedChildAccount({
  householdId,
  children,
  childId,
  onAccountChanged,
}: {
  householdId: number | null;
  children: import("../api").Child[];
  childId: number;
  onAccountChanged: () => Promise<void>;
}): ReactElement {
  const { manageableModuleKeys } = useAuth();
  const actions = useChildAccountActions({
    children,
    householdId,
    selectedChildId: childId,
    onAccountChanged,
    canManage: manageableModuleKeys.includes("chores"),
  });
  return (
    <ChildAccountPanels
      actions={actions}
      children={children}
      selectedChildId={childId}
    />
  );
}
