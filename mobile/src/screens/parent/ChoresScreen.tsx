import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import type { AuthSessionResponse } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  DailyChoreBoardPanel,
  SelectedChoreSubmitPanel,
} from "../../features/chores/components/ChoreBoardPanels";
import { ChoreForm } from "../../features/chores/components/ChoreForm";
import { ChoreList } from "../../features/chores/components/ChoreList";
import { ParentTaskPanel } from "../../features/chores/components/ParentTaskPanel";
import { useChoreData } from "../../features/chores/hooks/useChoreData";
import { useChoreMutations } from "../../features/chores/hooks/useChoreMutations";
import { colors } from "../../styles/colors";
import { todayDateString } from "../../utils/date";

export function ChoresScreen({
  session,
  initialChildId,
  initialDate,
}: {
  session: AuthSessionResponse;
  initialChildId?: number;
  initialDate?: string;
}) {
  const [management, setManagement] = useState(false);
  const householdId = session.user.household_id;
  const data = useChoreData({ householdId, initialChildId, initialDate });
  const mutations = useChoreMutations({
    canSubmitChores: data.canSubmitChores,
    clearMyTasksError: data.clearMyTasksError,
    clearSelectedChores: data.clearSelectedChores,
    householdId,
    loadChildrenAndEligible: data.loadChildrenAndEligible,
    loadChores: data.loadChores,
    loadMyTasks: data.loadMyTasks,
    myTasksError: data.myTasksError,
    patchEligibleChildState: data.patchEligibleChildState,
    refreshEligibleForChild: data.refreshEligibleForChild,
    selectedChild: data.selectedChild,
    selectedChoreIds: data.selectedChoreIds,
    setChoresError: data.setChoresError,
    setSelectedSubmitError: data.setSelectedSubmitError,
    setSelectedSubmitSuccess: data.setSelectedSubmitSuccess,
    targetDate: data.targetDate,
    userId: session.user.id,
  });

  return (
    <View>
      <ScreenHeader
        subtitle="Board, submissions, and setup"
        title="Chores"
        trailing={
          <ActionButton
            compact
            label="Add"
            onPress={mutations.openCreateForm}
            requiresManage
            variant="secondary"
          />
        }
      />

      <DailyChoreBoardPanel
        busy={mutations.quickSubmitting || mutations.selectedSubmitting}
        childrenState={data.childrenState}
        onDateChange={data.changeTargetDate}
        onRefresh={data.loadChildrenAndEligible}
        onToday={() => data.changeTargetDate(todayDateString())}
        targetDate={data.targetDate}
      />

      <SelectedChoreSubmitPanel
        activeChildren={data.activeChildren}
        onChildSelect={data.selectChild}
        onChoreToggle={data.toggleSelectedChore}
        onSubmit={mutations.submitSelected}
        onQuickSubmit={mutations.quickSubmit}
        targetDate={data.targetDate}
        selectedChild={data.selectedChild}
        selectedChildId={data.selectedChildId}
        selectedChoreIds={data.selectedChoreIds}
        selectedEligibleState={data.selectedEligibleState}
        submitError={data.selectedSubmitError}
        submitSuccess={data.selectedSubmitSuccess}
        submitting={mutations.selectedSubmitting || mutations.quickSubmitting}
      />

      <ParentTaskPanel
        tasks={data.myTasks}
        onComplete={mutations.completeParentTask}
      />

      {mutations.saveSuccess ? (
        <InlineNotice tone="success" message={mutations.saveSuccess} />
      ) : null}
      {mutations.showForm ? (
        <Modal
          testID="chore-editor-modal"
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={mutations.cancelForm}
        >
          <View
            accessibilityViewIsModal
            style={{ flex: 1, backgroundColor: colors.surface }}
          >
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editor}
            >
              <ChoreForm
                activeChildren={data.activeChildren}
                editingId={mutations.editingId}
                form={mutations.form}
                onCancel={mutations.cancelForm}
                onSubmit={mutations.submitChoreForm}
                setField={mutations.setField}
                setForm={mutations.setForm}
                showInterval={mutations.showInterval}
                submitting={mutations.submittingForm}
                submitError={mutations.submitError}
              />
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      <ActionButton
        label={management ? "Hide chore management" : "Manage chores"}
        onPress={() => setManagement(!management)}
        variant="secondary"
      />
      {management ? (
        <ChoreList
          archivingId={mutations.archivingId}
          children={data.childrenState.children}
          choresState={data.choresState}
          onArchive={mutations.confirmArchive}
          onEdit={mutations.openEditForm}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { padding: 16, paddingTop: 32, flexGrow: 1 },
});
