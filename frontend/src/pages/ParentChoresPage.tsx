import type { ReactElement } from "react";

import { useAuth } from "../auth/useAuth";
import { ChoreForm } from "../features/chores/components/ChoreForm";
import { ChoreList } from "../features/chores/components/ChoreList";
import { DailyChoreBoardPanel } from "../features/chores/components/DailyChoreBoardPanel";
import { EligibleChorePanel } from "../features/chores/components/EligibleChorePanel";
import { ParentTaskPanel } from "../features/chores/components/ParentTaskPanel";
import { SelectedChoreSubmitPanel } from "../features/chores/components/SelectedChoreSubmitPanel";
import { useChoreMutations } from "../features/chores/hooks/useChoreMutations";
import { useChores } from "../features/chores/hooks/useChores";
import { useEligibleChores } from "../features/chores/hooks/useEligibleChores";
import { Badge, Button, ButtonLink, Card } from "../ui";

export function ParentChoresPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const eligible = useEligibleChores(householdId);
  const chores = useChores({
    householdId,
    targetDate: eligible.targetDate,
    userId: user?.id ?? null,
  });
  const mutations = useChoreMutations({
    clearSelectedChores: eligible.clearSelectedChores,
    householdId,
    loadChildrenAndEligible: eligible.loadChildrenAndEligible,
    loadChores: chores.loadChores,
    loadMyTasks: chores.loadMyTasks,
    patchEligibleChildState: eligible.patchEligibleChildState,
    refreshEligibleForChild: eligible.refreshEligibleForChild,
    selectedChild: eligible.selectedChild,
    selectedChoreIds: eligible.selectedChoreIds,
    setChoresError: chores.setChoresError,
    targetDate: eligible.targetDate,
    userId: user?.id ?? null,
  });

  function handleDateChange(date: string): void {
    eligible.changeTargetDate(date);
    mutations.clearSelectedSubmitFeedback();
  }

  function handleToday(): void {
    eligible.selectToday();
    mutations.clearSelectedSubmitFeedback();
  }

  function handleSelectedChildChange(childId: string): void {
    eligible.changeSelectedChild(childId);
    mutations.clearSelectedSubmitFeedback();
  }

  function handleBoardRefresh(): void {
    mutations.clearSelectedSubmitFeedback();
    void eligible.loadChildrenAndEligible();
  }

  return (
    <section className="dashboard-grid" aria-label="Parent chore tracker">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Parent workspace</p>
            <h1>Chores</h1>
          </div>
          <Badge>
            {eligible.activeChildren.length} active child
            {eligible.activeChildren.length === 1 ? "" : "ren"}
          </Badge>
        </div>
        <p>
          Review what is available, submit completed chores for children, and
          maintain the household chore setup.
        </p>
        <div className="quick-actions">
          <Button
            type="button"
            onClick={handleBoardRefresh}
            disabled={eligible.childrenState.loading}
          >
            {eligible.childrenState.loading ? "Refreshing..." : "Refresh"}
          </Button>
          <ButtonLink to="/board">Review Submissions</ButtonLink>
          <Button type="button" onClick={mutations.openCreateForm}>
            Add Chore
          </Button>
        </div>
      </Card>

      <ParentTaskPanel
        myTasks={chores.myTasks}
        onComplete={(choreId) => void mutations.completeParentTask(choreId)}
        targetDate={eligible.targetDate}
      />

      <DailyChoreBoardPanel
        activeChildCount={eligible.activeChildren.length}
        childrenState={eligible.childrenState}
        onDateChange={handleDateChange}
        onToday={handleToday}
        targetDate={eligible.targetDate}
      />

      {!eligible.childrenState.loading && eligible.childrenState.error === null
        ? eligible.activeChildren.map((child) => (
            <EligibleChorePanel
              key={child.id}
              child={child}
              state={eligible.getEligibleState(child.id)}
              onQuickSubmit={(panelChild, chore) =>
                void mutations.handleQuickSubmit(panelChild, chore)
              }
            />
          ))
        : null}

      <SelectedChoreSubmitPanel
        activeChildren={eligible.activeChildren}
        onChildChange={handleSelectedChildChange}
        onRefresh={() => {
          if (eligible.selectedChild !== null) {
            void eligible.refreshEligibleForChild(eligible.selectedChild.id);
          }
        }}
        onSubmit={() => void mutations.handleSelectedSubmit()}
        onToggleChore={eligible.toggleSelectedChore}
        selectedChild={eligible.selectedChild}
        selectedChildId={eligible.selectedChildId}
        selectedChoreIds={eligible.selectedChoreIds}
        selectedEligibleState={eligible.selectedEligibleState}
        submitError={mutations.selectedSubmitError}
        submitSuccess={mutations.selectedSubmitSuccess}
        submitting={mutations.selectedSubmitting}
        targetDate={eligible.targetDate}
      />

      <div className="dashboard-section-header">
        <p className="eyebrow">Setup</p>
        <h2>Chore Management</h2>
        <p>Create, edit, rotate, and archive household chores.</p>
      </div>

      {mutations.showForm ? (
        <ChoreForm
          children={eligible.childrenState.children}
          editingId={mutations.editingId}
          form={mutations.form}
          onCancel={mutations.cancelForm}
          onSubmit={(event) => void mutations.handleSubmit(event)}
          setField={mutations.setField}
          showInterval={mutations.showInterval}
          submitError={mutations.submitError}
          submitting={mutations.submittingForm}
        />
      ) : null}

      <ChoreList
        archivingId={mutations.archivingId}
        children={eligible.childrenState.children}
        choresState={chores.choresState}
        onArchive={(chore) => void mutations.handleArchive(chore)}
        onCreate={mutations.openCreateForm}
        onEdit={mutations.openEditForm}
        showForm={mutations.showForm}
      />
    </section>
  );
}
