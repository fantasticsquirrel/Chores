import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";

import type { AuthSessionResponse } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { colors } from "../../styles/colors";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ChildAccountPanels } from "../../features/children/components/ChildAccountPanels";
import {
  AddChildPanel,
  ChildrenListPanel,
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
  const [adding, setAdding] = useState(false);
  const [accountChildId, setAccountChildId] = useState<number | null>(null);

  return (
    <View>
      <ScreenHeader
        subtitle="Profiles and child-friendly login credentials"
        title="Children"
        trailing={
          <ActionButton
            compact
            label={adding ? "Close Add Child" : "Add Child"}
            onPress={() => setAdding(!adding)}
            variant="secondary"
          />
        }
      />
      {adding ? <AddChildPanel mutations={mutations} /> : null}
      {!adding && mutations.submitError ? (
        <InlineNotice tone="error" message={mutations.submitError} />
      ) : null}
      {!adding && mutations.submitSuccess ? (
        <InlineNotice tone="success" message={mutations.submitSuccess} />
      ) : null}
      <ChildrenListPanel
        state={children.state}
        selectedChildId={accountChildId}
        onSelect={(childId) =>
          setAccountChildId((current) => (current === childId ? null : childId))
        }
        mutations={mutations}
      />
      {accountChildId !== null ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAccountChildId(null)}
        >
          <View
            accessibilityViewIsModal
            style={{ flex: 1, backgroundColor: colors.surface }}
          >
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingTop: 32 }}
            >
              <ActionButton
                label="Close account tools"
                onPress={() => setAccountChildId(null)}
                variant="secondary"
              />
              <SelectedChildAccount
                key={accountChildId}
                householdId={householdId}
                children={children.state.children}
                childId={accountChildId}
                onAccountChanged={children.loadChildren}
              />
            </ScrollView>
          </View>
        </Modal>
      ) : null}
      <ActionButton
        label="Refresh children"
        disabled={children.state.loading}
        onPress={children.loadChildren}
        variant="secondary"
      />
    </View>
  );
}

function SelectedChildAccount({
  householdId,
  children,
  childId,
  onAccountChanged,
}: {
  householdId: number;
  children: import("../../api/models").Child[];
  childId: number;
  onAccountChanged: () => Promise<void>;
}) {
  const actions = useChildAccountActions({
    children,
    householdId,
    selectedChildId: childId,
    onAccountChanged,
  });
  const child = children.find((item) => item.id === childId);
  return (
    <ChildAccountPanels
      actions={actions}
      childrenAvailable={!!child}
      childName={child?.name ?? "Child"}
      hasLogin={child?.has_login}
    />
  );
}
