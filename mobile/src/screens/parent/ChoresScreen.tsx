import { View } from "react-native";

import type { AuthSessionResponse } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  ChoreEligibilityPanel,
  DailyChoreBoardPanel,
  SelectedChoreSubmitPanel,
} from "../../features/chores/components/ChoreBoardPanels";
import { ChoreForm } from "../../features/chores/components/ChoreForm";
import { ChoreList } from "../../features/chores/components/ChoreList";
import { ParentTaskPanel } from "../../features/chores/components/ParentTaskPanel";
import { useChoreData } from "../../features/chores/hooks/useChoreData";
import { useChoreMutations } from "../../features/chores/hooks/useChoreMutations";
import { todayDateString } from "../../utils/date";

export function ChoresScreen({ session }: { session: AuthSessionResponse }) {
  const householdId = session.user.household_id;
  const data = useChoreData({ householdId });
  const mutations = useChoreMutations({
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
            variant="secondary"
          />
        }
      />

      <DailyChoreBoardPanel
        childrenState={data.childrenState}
        onDateChange={data.changeTargetDate}
        onRefresh={data.loadChildrenAndEligible}
        onToday={() => data.changeTargetDate(todayDateString())}
        targetDate={data.targetDate}
      />

      <ParentTaskPanel
        tasks={data.myTasks}
        onComplete={mutations.completeParentTask}
      />

      <ChoreEligibilityPanel
        activeChildren={data.activeChildren}
        childrenState={data.childrenState}
        getEligibleState={data.getEligibleState}
        onQuickSubmit={mutations.quickSubmit}
      />

      <SelectedChoreSubmitPanel
        activeChildren={data.activeChildren}
        onChildSelect={data.selectChild}
        onChoreToggle={data.toggleSelectedChore}
        onSubmit={mutations.submitSelected}
        selectedChild={data.selectedChild}
        selectedChildId={data.selectedChildId}
        selectedChoreIds={data.selectedChoreIds}
        selectedEligibleState={data.selectedEligibleState}
        submitError={data.selectedSubmitError}
        submitSuccess={data.selectedSubmitSuccess}
        submitting={mutations.selectedSubmitting}
      />

      {mutations.showForm ? (
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
      ) : null}

      <ChoreList
        archivingId={mutations.archivingId}
        children={data.childrenState.children}
        choresState={data.choresState}
        onArchive={mutations.confirmArchive}
        onEdit={mutations.openEditForm}
      />
    </View>
  );
}
