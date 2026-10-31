import { useEffect, useRef, type ReactElement } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { ChoreForm } from "../features/chores/components/ChoreForm";
import { ChoreList } from "../features/chores/components/ChoreList";
import { DailyChoreBoardPanel } from "../features/chores/components/DailyChoreBoardPanel";
import { ChoreEditorDialog } from "../features/chores/components/ChoreEditorDialog";
import { ParentTaskPanel } from "../features/chores/components/ParentTaskPanel";
import { SelectedChoreSubmitPanel } from "../features/chores/components/SelectedChoreSubmitPanel";
import { useChoreMutations } from "../features/chores/hooks/useChoreMutations";
import { useChores } from "../features/chores/hooks/useChores";
import { useEligibleChores } from "../features/chores/hooks/useEligibleChores";
import { Badge, Button, ButtonLink, Card, InlineNotice } from "../ui";

export function ParentChoresPage(): ReactElement {
  const { user, manageableModuleKeys } = useAuth();
  const canManage = manageableModuleKeys.includes("chores");
  const householdId = user?.household_id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const lastEditor = useRef<string | null>(null);
  const eligible = useEligibleChores(householdId, {
    childId: searchParams.get("childId") ?? undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") ?? "")
      ? searchParams.get("date")!
      : undefined,
  });
  const chores = useChores({
    householdId,
    targetDate: eligible.targetDate,
    userId: user?.id ?? null,
  });
  const mutations = useChoreMutations({
    canSubmitChores: eligible.canSubmitChores,
    canManage,
    onFormSaved: () => {
      lastEditor.current = null;
      closeEditor();
    },
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

  const {
    cancelForm,
    resumeForm,
    openCreateForm,
    openEditForm,
    showForm,
    submittingForm,
  } = mutations;
  const editorMarker = searchParams.get("editor");
  useEffect(() => {
    if (!canManage || !editorMarker) {
      if (showForm) cancelForm();
      return;
    }
    if (showForm && lastEditor.current === editorMarker) return;
    if (lastEditor.current === editorMarker) {
      resumeForm();
      return;
    }
    if (submittingForm) return;
    if (editorMarker === "new") {
      lastEditor.current = editorMarker;
      openCreateForm();
    } else {
      const chore = chores.choresState.chores.find(
        (item) => String(item.id) === editorMarker,
      );
      if (chore) {
        lastEditor.current = editorMarker;
        openEditForm(chore);
      }
    }
  }, [
    canManage,
    editorMarker,
    showForm,
    submittingForm,
    cancelForm,
    resumeForm,
    openCreateForm,
    openEditForm,
    chores.choresState.chores,
  ]);

  function closeEditor(): void {
    if (!searchParams.has("editor")) return;
    if (location.state?.choreEditor === true) navigate(-1);
    else {
      const next = new URLSearchParams(searchParams);
      next.delete("editor");
      setSearchParams(next, { replace: true });
    }
  }
  function openCreate(): void {
    if (!canManage || submittingForm) return;
    const next = new URLSearchParams(searchParams);
    next.set("editor", "new");
    setSearchParams(next, { state: { choreEditor: true } });
  }
  function openEdit(chore: Parameters<typeof mutations.openEditForm>[0]): void {
    if (!canManage || submittingForm) return;
    const next = new URLSearchParams(searchParams);
    next.set("editor", String(chore.id));
    setSearchParams(next, { state: { choreEditor: true } });
  }

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
            <h1>Chores</h1>
          </div>
          <Badge>
            {eligible.activeChildren.length} active child
            {eligible.activeChildren.length === 1 ? "" : "ren"}
          </Badge>
        </div>
        <p>Review, submit, and manage household chores.</p>
        <div className="quick-actions">
          <Button type="button" onClick={openCreate} disabled={submittingForm}>
            Add Chore
          </Button>
          <ButtonLink variant="secondary" to="/board">
            Review Submissions
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            onClick={handleBoardRefresh}
            disabled={
              eligible.childrenState.loading ||
              mutations.quickSubmitting ||
              mutations.selectedSubmitting
            }
          >
            {eligible.childrenState.loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </Card>

      <DailyChoreBoardPanel
        busy={mutations.quickSubmitting || mutations.selectedSubmitting}
        activeChildCount={eligible.activeChildren.length}
        childrenState={eligible.childrenState}
        onDateChange={handleDateChange}
        onToday={handleToday}
        targetDate={eligible.targetDate}
      />

      <SelectedChoreSubmitPanel
        activeChildren={eligible.activeChildren}
        onChildChange={handleSelectedChildChange}
        onRefresh={() => {
          if (eligible.selectedChild !== null) {
            void eligible.refreshEligibleForChild(eligible.selectedChild.id);
          }
        }}
        onSubmit={() => void mutations.handleSelectedSubmit()}
        onQuickSubmit={(child, chore) =>
          void mutations.handleQuickSubmit(child, chore)
        }
        onToggleChore={eligible.toggleSelectedChore}
        selectedChild={eligible.selectedChild}
        selectedChildId={eligible.selectedChildId}
        selectedChoreIds={eligible.selectedChoreIds}
        selectedEligibleState={eligible.selectedEligibleState}
        submitError={mutations.selectedSubmitError}
        submitSuccess={mutations.selectedSubmitSuccess}
        submitting={mutations.selectedSubmitting || mutations.quickSubmitting}
        targetDate={eligible.targetDate}
      />

      <ParentTaskPanel
        myTasks={chores.myTasks}
        onComplete={(choreId) => void mutations.completeParentTask(choreId)}
        targetDate={eligible.targetDate}
      />

      {submittingForm && !editorMarker ? (
        <InlineNotice role="status" style={{ gridColumn: "1 / -1" }}>
          Saving chore… You can keep browsing.
        </InlineNotice>
      ) : null}
      {mutations.saveSuccess ? (
        <InlineNotice
          role="status"
          style={{ gridColumn: "1 / -1" }}
          variant="success"
        >
          {mutations.saveSuccess}
        </InlineNotice>
      ) : null}

      {canManage && mutations.showForm && editorMarker ? (
        <ChoreEditorDialog
          title={mutations.editingId === null ? "New Chore" : "Edit Chore"}
          busy={mutations.submittingForm}
          onClose={closeEditor}
        >
          <ChoreForm
            children={eligible.childrenState.children}
            editingId={mutations.editingId}
            form={mutations.form}
            onCancel={closeEditor}
            onSubmit={(event) => void mutations.handleSubmit(event)}
            setField={mutations.setField}
            showInterval={mutations.showInterval}
            submitError={mutations.submitError}
            submitting={mutations.submittingForm}
          />
        </ChoreEditorDialog>
      ) : null}

      <details className="chore-management-disclosure">
        <summary>Manage chores</summary>
        <ChoreList
          archivingId={mutations.archivingId}
          children={eligible.childrenState.children}
          choresState={chores.choresState}
          onArchive={(chore) => void mutations.handleArchive(chore)}
          onCreate={openCreate}
          onEdit={openEdit}
          showForm={true}
        />
      </details>
    </section>
  );
}
