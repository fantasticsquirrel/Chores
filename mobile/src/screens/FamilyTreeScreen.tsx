import { createRef, useEffect, useRef, useState, type RefObject } from "react";
import { Text, View } from "react-native";
import type { LayoutOptions } from "@family-manager/family-tree-core";
import type {
  AuthSessionResponse,
  FamilyModule,
  FamilyTreeLivingStatus,
  FamilyTreePersonInput,
} from "../api/models";
import { apiClient } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionCard } from "../components/SectionCard";
import { InlineNotice } from "../components/InlineNotice";
import { formStyles } from "../styles/forms";
import { shellStyles } from "../styles/shell";
import { useFamilyTree } from "../features/family-tree/hooks/useFamilyTree";
import {
  NativeEditor,
  TreeChoice,
  TreeTextField,
  TreeToggle,
} from "../features/family-tree/forms/NativeEditor";
import {
  DraftMemory,
  useDraftMemory,
} from "../features/family-tree/forms/DraftMemory";
import { TreeRecovery } from "../features/family-tree/forms/TreeRecovery";
import { PersonWorkspace } from "../features/family-tree/forms/PersonWorkspace";
import { PersonAdvanced } from "../features/family-tree/forms/PersonAdvanced";
import { TransferTools } from "../features/family-tree/forms/TransferTools";
import { useTreeTools } from "../features/family-tree/hooks/useTreeTools";
import { personFields } from "../features/family-tree/forms/payload";
import {
  initialLens,
  lensParams,
  personName,
  projectionInput,
} from "../features/family-tree/lib/workflows/view";
import { FamilyTreeButton } from "../features/family-tree/components/FamilyTreeControls";
import { FamilyTreeGraph } from "../features/family-tree/components/FamilyTreeGraph";
import { FamilyTreeDialog } from "../features/family-tree/components/FamilyTreeDialog";
import { BirthBandColorScope } from "../features/family-tree/components/BirthBandColorScope";
import { useBirthBandColors } from "../features/family-tree/hooks/useBirthBandColors";
type Props = {
  session: AuthSessionResponse;
  modules: FamilyModule[];
  onModulesLoaded: (modules: FamilyModule[]) => void;
};
export function FamilyTreeScreen(props: Props) {
  return (
    <DraftMemory
      key={`${props.session.user.household_id}:${props.session.user.id}:${props.session.user.role}:${apiClient.authenticationGeneration}`}
    >
      <BirthBandColorScope>
        <TreeScreen {...props} />
      </BirthBandColorScope>
    </DraftMemory>
  );
}
function TreeScreen({ session, onModulesLoaded }: Props) {
  const { state, workflow } = useFamilyTree(session, onModulesLoaded);
  const tools = useTreeTools(workflow, state);
  const drafts = useDraftMemory();
  const presentation = useBirthBandColors();
  useEffect(() => {
    if (state.access === "denied") presentation.reset();
    // Access retirement, not draft/revision epochs or temporary read failures.
  }, [state.access, presentation.reset]);
  const draftEpoch = useRef(state.draftEpoch);
  if (draftEpoch.current !== state.draftEpoch) {
    drafts.clear();
    draftEpoch.current = state.draftEpoch;
  }
  const fallbackFocus = useRef<Text>(null),
    addFocus = useRef<View>(null);
  const [trigger, setTrigger] = useState<RefObject<View | null> | undefined>(
    undefined,
  );
  const directoryRefs = useRef(new Map<number, RefObject<View | null>>());
  function personTrigger(id: number) {
    let ref = directoryRefs.current.get(id);
    if (!ref) {
      ref = createRef<View>();
      directoryRefs.current.set(id, ref);
    }
    return ref;
  }
  const [creating, setCreating] = useState(false),
    [dirty, setDirty] = useState(false),
    [discardOpen, setDiscardOpen] = useState(false);
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [living, setLiving] = useState("all"),
    [archived, setArchived] = useState(false),
    [options, setOptions] = useState<LayoutOptions>(initialLens);
  const discardAction = useRef<(() => void) | null>(null);
  const allowed = state.access === "view" || state.access === "manage";
  useEffect(() => {
    setCreating(false);
    setDirty(false);
    setDiscardOpen(false);
    setQuery("");
    setTag("");
    setLiving("all");
    setArchived(false);
    setOptions(initialLens);
    discardAction.current = null;
  }, [state.draftEpoch]);
  useEffect(() => {
    drafts.clear();
    setOptions((old) => ({
      ...old,
      collapsedAncestors:
        workflow.graphParams.collapsed_up_ids ?? old.collapsedAncestors,
      collapsedDescendants:
        workflow.graphParams.collapsed_down_ids ?? old.collapsedDescendants,
    }));
    setCreating(false);
    setDirty(false);
    setDiscardOpen(false);
  }, [state.successCount]);
  function requestDiscard(action: () => void) {
    if (state.busy) return;
    const commit = () => {
      drafts.clear();
      action();
    };
    if (dirty || state.pending) {
      discardAction.current = commit;
      setDiscardOpen(true);
    } else commit();
  }
  function close() {
    requestDiscard(() => {
      setCreating(false);
      setDirty(false);
      workflow.discardPending();
      workflow.closeDetail();
    });
  }
  function select(id: number) {
    requestDiscard(() => {
      setCreating(false);
      setDirty(false);
      workflow.discardPending();
      void workflow.select(id);
    });
  }
  function updateLens(next: LayoutOptions) {
    setOptions(next);
    void workflow.setLens(lensParams(next));
  }
  if (!allowed)
    return (
      <View>
        <ScreenHeader title="Family Tree" subtitle="Household family history" />
        <TreeRecovery
          state={state}
          workflow={workflow}
          requestDiscard={requestDiscard}
          setDirty={setDirty}
        />
        {state.access === "denied" && !state.error ? (
          <>
            <InlineNotice
              tone="warning"
              message="Family Tree is available only to authorized adults."
            />
            <ActionButton
              label="Retry Family Tree"
              disabled={state.loading}
              variant="secondary"
              onPress={() => void workflow.refresh()}
            />
          </>
        ) : null}
      </View>
    );
  const modal = creating || state.selectedId !== null;
  const mutationDisabled =
    state.access !== "manage" ||
    state.collection?.capabilities.can_manage !== true ||
    state.busy ||
    state.toolsPending ||
    !!state.error ||
    state.loading ||
    !!state.pending;
  return (
    <View>
      <ScreenHeader
        title="Family Tree"
        subtitle="Shared household history — no offline editing"
        trailing={
          <ActionButton
            label="Refresh"
            disabled={state.loading || state.busy}
            variant="secondary"
            onPress={() => void workflow.refresh()}
          />
        }
      />
      {state.access === "view" ? (
        <InlineNotice tone="warning" message="View-only Family Tree" />
      ) : null}
      {modal ? null : (
        <TreeRecovery
          state={state}
          workflow={workflow}
          requestDiscard={requestDiscard}
          setDirty={setDirty}
        />
      )}
      {state.collection?.active_people_count === 0 ? (
        <SectionCard title="Start your family tree">
          <Text style={shellStyles.mutedText}>
            Add the first person. Relatives do not need Family Manager accounts.
            No family relationships are inferred.
          </Text>
        </SectionCard>
      ) : null}
      <Text
        ref={fallbackFocus}
        accessible
        accessibilityRole="header"
        style={formStyles.rowTitle}
      >
        Explore household family history
      </Text>
      <FamilyTreeButton
        buttonRef={addFocus}
        label="Add person"
        disabled={mutationDisabled}
        onPress={() => {
          setTrigger(addFocus);
          setCreating(true);
          setDirty(false);
        }}
      />
      {state.graph ? (
        <SectionCard title="Family graph">
          <FamilyTreeGraph
            graph={projectionInput(state.graph)}
            focusPersonId={state.focusId}
            graphRevision={state.graph.graph_revision}
            onSelectPerson={select}
            onPersonTrigger={setTrigger}
            onFocusPerson={(id) => void workflow.focus(id)}
            options={{
              ...options,
              limits: {
                maxNodes: state.graph.projection_limits.hard_max_nodes,
                maxEdges: state.graph.projection_limits.hard_max_edges,
              },
            }}
            maxDepth={10}
            expansionCounts={Object.fromEntries(
              state.graph.nodes.map((p) => [p.id, p.expansion_counts]),
            )}
            onOptionsChange={updateLens}
            expansionToken={state.graph.expansion_token}
            onLoadMore={() => void workflow.loadGraph(true)}
            loading={state.loading || state.busy}
          />
          {state.graph.warnings.map((w, i) => (
            <Text key={i} style={shellStyles.mutedText}>
              {w}
            </Text>
          ))}
        </SectionCard>
      ) : null}
      <SectionCard title="People directory">
        <TreeTextField
          label="Search people"
          value={query}
          onChange={setQuery}
          disabled={state.busy}
        />
        <TreeTextField
          label="Filter tag"
          value={tag}
          onChange={setTag}
          disabled={state.busy}
        />
        <TreeChoice
          label="Living state filter"
          value={living}
          options={["all", "unknown", "living", "deceased"]}
          onChange={setLiving}
          disabled={state.busy}
        />
        <TreeToggle
          label="Show archived people"
          value={archived}
          onChange={setArchived}
          disabled={state.busy}
        />
        <ActionButton
          label="Search directory"
          disabled={state.loading || state.busy}
          variant="secondary"
          onPress={() =>
            void workflow.search({
              query,
              tag: tag || null,
              living_status:
                living === "all" ? null : (living as FamilyTreeLivingStatus),
              archived,
            })
          }
        />
        {state.people?.items.length === 0 ? (
          <Text style={shellStyles.mutedText}>No matching people.</Text>
        ) : null}
        {state.people?.items.map((p) => (
          <View key={p.id}>
            <FamilyTreeButton
              buttonRef={personTrigger(p.id)}
              label={`Open ${personName(p)} (#${p.id})`}
              disabled={state.busy || state.loading}
              onPress={() => {
                setTrigger(personTrigger(p.id));
                select(p.id);
              }}
            />
            <Text style={shellStyles.mutedText}>
              {p.living_status}
              {p.is_locked ? " · Protected" : ""}
              {p.archived_at ? " · Archived" : ""}
              {p.merged_into_person_id
                ? ` · Alias of #${p.merged_into_person_id}`
                : ""}
            </Text>
            <ActionButton
              label={`Focus ${personName(p)} (#${p.id})`}
              disabled={
                state.busy ||
                state.loading ||
                !!p.archived_at ||
                !!p.merged_into_person_id
              }
              variant="secondary"
              onPress={() => void workflow.focus(p.id)}
            />
          </View>
        ))}
        {state.people?.next_cursor ? (
          <ActionButton
            label="Load more people"
            disabled={state.loading || state.busy}
            variant="secondary"
            onPress={() => void workflow.morePeople()}
          />
        ) : null}
        <Text style={shellStyles.mutedText}>
          {state.people
            ? `${state.people.items.length} shown of ${state.people.total}`
            : ""}
        </Text>
      </SectionCard>
      <TransferTools tools={tools} state={state} />
      <FamilyTreeDialog
        visible={modal}
        title={
          creating
            ? "Add person"
            : state.detail
              ? personName(state.detail.person)
              : "Person details"
        }
        onRequestClose={close}
        returnFocusRef={trigger}
        fallbackFocusRef={fallbackFocus}
      >
        <TreeRecovery
          state={state}
          workflow={workflow}
          requestDiscard={requestDiscard}
          setDirty={setDirty}
        />
        {discardOpen ? (
          <SectionCard title="Discard unsaved family history?">
            <Text style={shellStyles.mutedText}>
              Unsaved edits are in memory only. They will be lost if discarded.
            </Text>
            <ActionButton
              label="Keep editing"
              variant="secondary"
              onPress={() => {
                setDiscardOpen(false);
                discardAction.current = null;
              }}
            />
            <ActionButton
              label="Discard draft"
              variant="danger"
              onPress={() => {
                setDiscardOpen(false);
                setDirty(false);
                const action = discardAction.current;
                discardAction.current = null;
                action?.();
              }}
            />
          </SectionCard>
        ) : null}
        <View
          style={discardOpen ? { display: "none" } : undefined}
          accessibilityElementsHidden={discardOpen}
          importantForAccessibility={
            discardOpen ? "no-hide-descendants" : "auto"
          }
        >
          {creating ? (
            <NativeEditor
              key={`create:${state.draftEpoch}`}
              title="New person"
              originRevision={state.collection?.graph_revision}
              fields={personFields}
              disabled={mutationDisabled}
              onDirty={setDirty}
              onSubmit={(person, revision) =>
                workflow.mutate(
                  {
                    type: "createPerson",
                    person: person as FamilyTreePersonInput,
                  },
                  revision,
                )
              }
            />
          ) : (
            <View>
              <PersonWorkspace
                key={`${state.selectedId}:${state.draftEpoch}`}
                state={state}
                workflow={workflow}
                onDirty={setDirty}
                requestDiscard={requestDiscard}
              />
              <PersonAdvanced
                key={`advanced:${state.selectedId}:${state.draftEpoch}`}
                tools={tools}
                state={state}
                core={workflow}
                onDirty={setDirty}
                requestDiscard={requestDiscard}
              />
            </View>
          )}
          {state.selectedId !== null && !state.detail && !state.loading ? (
            <ActionButton
              label="Retry person"
              disabled={state.busy}
              variant="secondary"
              onPress={() => void workflow.select(state.selectedId!)}
            />
          ) : null}
        </View>
      </FamilyTreeDialog>
    </View>
  );
}
