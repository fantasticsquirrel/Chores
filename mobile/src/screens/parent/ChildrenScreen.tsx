import { View } from "react-native";

import type { AuthSessionResponse } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ChildAccountPanels } from "../../features/children/components/ChildAccountPanels";
import {
  AddChildPanel,
  ChildrenListPanel,
  ChildSelectionPanel,
} from "../../features/children/components/ChildManagementPanels";
import { useChildAccountActions } from "../../features/children/hooks/useChildAccountActions";
import { useChildMutations } from "../../features/children/hooks/useChildMutations";
import { useChildren } from "../../features/children/hooks/useChildren";

export function ChildrenScreen({ session }: { session: AuthSessionResponse }) {
  const householdId = session.user.household_id;
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
    <View>
      <ScreenHeader
        subtitle="Profiles and child-friendly login credentials"
        title="Children"
        trailing={
          <ActionButton
            compact
            disabled={children.state.loading}
            label={children.state.loading ? "Loading" : "Refresh"}
            onPress={children.loadChildren}
            variant="secondary"
          />
        }
      />
      <AddChildPanel mutations={mutations} />
      <ChildSelectionPanel
        onSelect={children.setSelectedChildId}
        selectedChildId={children.selectedChildId}
        state={children.state}
      />
      <ChildAccountPanels
        actions={accountActions}
        childrenAvailable={children.state.children.length > 0}
      />
      <ChildrenListPanel
        children={children.state.children}
        mutations={mutations}
      />
    </View>
  );
}
