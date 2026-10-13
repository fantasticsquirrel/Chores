import { useEffect, useRef, useState } from "react";
import { useDraftState } from "./DraftMemory";
import { Text, View } from "react-native";
import type * as FT from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { InlineNotice } from "../../../components/InlineNotice";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { TreeTextField } from "./NativeEditor";
import { PersonEditors, type Editor } from "./PersonEditors";
import { PersonRecordsPanels } from "./PersonRecordsPanels";
import { personFields, type Direction } from "./payload";
import { dateLabel, personName } from "../lib/workflows/view";
import type { TreeAction } from "../lib/workflows/commands";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
export function PersonWorkspace({
  state,
  workflow,
  onDirty,
  requestDiscard,
}: {
  state: TreeState;
  workflow: TreeWorkflow;
  onDirty: (dirty: boolean) => void;
  requestDiscard: (action: () => void) => void;
}) {
  const [editor, setEditor] = useDraftState<Editor | null>(
      `person:${state.selectedId}:editor`,
      () => null,
    ),
    [readStory, setReadStory] = useState<FT.FamilyTreeStory | null>(null),
    [candidate, setCandidate] =
      useDraftState<FT.FamilyTreeIdentityCandidate | null>(
        `person:${state.selectedId}:identity`,
        () => null,
      ),
    [reason, setReason] = useDraftState(
      `person:${state.selectedId}:reason`,
      () => "",
    ),
    [confirmation, setConfirmationState] = useState<{
      action: TreeAction;
      label: string;
      revision: number;
    } | null>(null);
  const [lastDetail, setLastDetail] = useState(state.detail);
  useEffect(() => {
    if (state.detail) setLastDetail(state.detail);
  }, [state.detail]);
  const completed = useRef(state.successCount);
  useEffect(() => {
    if (completed.current === state.successCount) return;
    completed.current = state.successCount;
    setEditor(null);
    setReadStory(null);
    setCandidate(null);
    setConfirmation(null);
    onDirty(false);
  }, [state.successCount]);
  const detail = state.detail ?? lastDetail;
  if (!detail)
    return (
      <Text style={shellStyles.mutedText}>
        {state.loading
          ? "Loading person, stories and residences…"
          : "Person unavailable. Retry the person or refresh Family Tree."}
      </Text>
    );
  const snapshotRevision = detail.graph_revision;
  const p = detail.person,
    name = personName(p),
    alias = p.merged_into_person_id !== null;
  const manager =
      state.access === "manage" &&
      state.collection?.capabilities.can_manage === true,
    disabled =
      state.busy ||
      state.toolsPending ||
      !!state.error ||
      state.loading ||
      !!state.pending ||
      !manager ||
      p.is_locked ||
      alias ||
      !!p.archived_at;
  const lifecycleDisabled =
    state.busy ||
    state.toolsPending ||
    state.loading ||
    !!state.pending ||
    !manager ||
    alias;
  function open(next: Editor) {
    if (disabled || snapshotRevision !== state.collection?.graph_revision)
      return;
    setEditor({ ...next, originRevision: snapshotRevision });
    onDirty(false);
  }
  function setConfirmation(
    value: { action: TreeAction; label: string } | null,
  ) {
    setConfirmationState(
      value ? { ...value, revision: snapshotRevision } : null,
    );
  }
  async function submit(action: TreeAction, originRevision = snapshotRevision) {
    return workflow.mutate(action, originRevision);
  }
  function editCancel() {
    requestDiscard(() => {
      setEditor(null);
      setCandidate(null);
      workflow.discardPending();
      onDirty(false);
    });
  }
  const search = (query: string) => void workflow.searchCandidates(query);
  const candidatePage = state.candidatePeople ?? state.people;
  const more = candidatePage?.next_cursor
    ? () =>
        void (state.candidatePeople
          ? workflow.moreCandidates()
          : workflow.morePeople())
    : undefined;
  const people = candidatePage?.items ?? [];
  if (readStory)
    return (
      <View>
        <Text accessibilityRole="header" style={formStyles.rowTitle}>
          {readStory.title}
        </Text>
        <Text style={shellStyles.mutedText}>
          {dateLabel(readStory.date)} · Contributor #
          {readStory.created_by_user_id ?? "removed"}
        </Text>
        <Text selectable style={formStyles.rowMeta}>
          {readStory.body_md}
        </Text>
        <Text style={shellStyles.mutedText}>{readStory.source_label}</Text>
        <Text selectable style={shellStyles.mutedText}>
          {readStory.source_url}
        </Text>
        <ActionButton
          label="Back to person"
          variant="secondary"
          onPress={() => setReadStory(null)}
        />
      </View>
    );
  if (editor)
    return (
      <PersonEditors
        editor={editor}
        state={state}
        workflow={workflow}
        onDirty={onDirty}
        p={p}
        name={name}
        disabled={disabled}
        manager={manager}
        people={people}
        more={more}
        search={search}
        submit={(action) => submit(action, editor.originRevision)}
        candidate={candidate}
        setCandidate={setCandidate}
        editCancel={editCancel}
      />
    );
  function relationship(
    type: "parent" | "care" | "partner",
    r:
      | FT.FamilyTreeParentLink
      | FT.FamilyTreeCareLink
      | FT.FamilyTreePartnerEpisode,
  ) {
    const endpoints =
      type === "parent"
        ? [
            (r as FT.FamilyTreeParentLink).parent_person_id,
            (r as FT.FamilyTreeParentLink).child_person_id,
          ]
        : type === "care"
          ? [
              (r as FT.FamilyTreeCareLink).caregiver_person_id,
              (r as FT.FamilyTreeCareLink).recipient_person_id,
            ]
          : [
              (r as FT.FamilyTreePartnerEpisode).person_a_id,
              (r as FT.FamilyTreePartnerEpisode).person_b_id,
            ];
    const idLabel = `${type} relationship #${r.id}`;
    return (
      <View key={`${type}:${r.id}`}>
        <Text style={formStyles.rowTitle}>
          {type} · {r.kind.replace(/_/g, " ")}
        </Text>
        {type !== "parent" ? (
          <Text style={shellStyles.mutedText}>
            {dateLabel((r as FT.FamilyTreeCareLink).start_date)} –{" "}
            {dateLabel((r as FT.FamilyTreeCareLink).end_date)}
            {type === "partner"
              ? ` · ${(r as FT.FamilyTreePartnerEpisode).status}`
              : ""}
          </Text>
        ) : null}
        <Text style={shellStyles.mutedText}>{r.notes_md}</Text>
        <Text selectable style={shellStyles.mutedText}>
          {r.source_label} {r.source_url}
        </Text>
        <Text style={shellStyles.mutedText}>
          Contributor #{r.created_by_user_id ?? "removed"}
        </Text>
        {endpoints
          .filter((id) => id !== p.id)
          .map((id) => (
            <ActionButton
              key={id}
              label={`Open related person #${id}`}
              variant="secondary"
              disabled={state.busy || state.loading}
              onPress={() => void workflow.select(id)}
            />
          ))}
        <View style={formStyles.inlineButtons}>
          <ActionButton
            label={`Edit ${idLabel}`}
            disabled={disabled}
            variant="secondary"
            onPress={() =>
              open({ type: "relationship", kind: type, record: r })
            }
          />
          <ActionButton
            label={`Delete ${idLabel}`}
            disabled={disabled}
            variant="danger"
            onPress={() =>
              setConfirmation({
                action: {
                  type:
                    type === "parent"
                      ? "deleteParent"
                      : type === "care"
                        ? "deleteCare"
                        : "deletePartner",
                  id: r.id,
                },
                label: `Delete ${idLabel}`,
              })
            }
          />
        </View>
      </View>
    );
  }
  return (
    <View>
      <Text accessibilityRole="header" style={formStyles.rowTitle}>
        {name}
      </Text>
      {alias ? (
        <InlineNotice
          tone="warning"
          message="This person is a non-editable merge alias. Open the canonical person."
        />
      ) : null}
      {alias ? (
        <ActionButton
          label={`Open canonical person #${p.merged_into_person_id}`}
          variant="secondary"
          onPress={() => void workflow.select(p.merged_into_person_id!)}
        />
      ) : null}
      {p.archived_at ? (
        <InlineNotice
          tone="warning"
          message="Archived person. Restore before changing history."
        />
      ) : null}
      {p.is_locked ? (
        <InlineNotice
          tone="warning"
          message={`Edit protected: ${p.lock_reason ?? "No reason recorded"}. Explicit unlock required.`}
        />
      ) : null}
      <View style={formStyles.inlineButtons}>
        <ActionButton
          label="Focus this person"
          disabled={state.loading || state.busy}
          variant="secondary"
          onPress={() => void workflow.focus(p.id)}
        />
        <ActionButton
          label="Edit person"
          disabled={disabled}
          onPress={() => open({ type: "person" })}
        />
        <ActionButton
          label="Compare connections"
          disabled={state.loading || state.busy || alias}
          variant="secondary"
          onPress={() => setEditor({ type: "compare" })}
        />
      </View>
      <SectionCard title="Recorded facts">
        {personFields.map((f) => {
          const value = (p as unknown as Record<string, unknown>)[f.key];
          const formatted =
            f.kind === "date"
              ? dateLabel(value as FT.FamilyTreePartialDate | null)
              : f.kind === "aliases"
                ? (value as FT.FamilyTreeAlias[])
                    .map((a) => `${a.name}${a.label ? ` (${a.label})` : ""}`)
                    .join(", ")
                : Array.isArray(value)
                  ? value.join(", ")
                  : String(value ?? "Unknown");
          return (
            <View key={f.key}>
              <Text style={formStyles.fieldLabel}>{f.label}</Text>
              <Text selectable style={shellStyles.mutedText}>
                {formatted || "Unknown"}
              </Text>
            </View>
          );
        })}
        <Text style={shellStyles.mutedText}>
          Created by contributor #{p.created_by_user_id ?? "removed"} ·{" "}
          {p.created_at}
        </Text>
      </SectionCard>
      <SectionCard title="Relationships">
        {detail.parent_links.map((r) => relationship("parent", r))}
        {detail.care_links.map((r) => relationship("care", r))}
        {detail.partner_episodes.map((r) => relationship("partner", r))}
        <Text style={shellStyles.mutedText}>
          Recorded co-parents do not imply a partnership. Care does not imply
          ancestry.
        </Text>
        {(
          [
            "parent",
            "child",
            "caregiver",
            "recipient",
            "partner",
          ] as Direction[]
        ).map((direction) => (
          <View key={direction} style={formStyles.inlineButtons}>
            <ActionButton
              label={`Add existing ${direction}`}
              disabled={disabled}
              variant="secondary"
              onPress={() =>
                open({ type: "relative", direction, newPerson: false })
              }
            />
            <ActionButton
              label={`Add new ${direction}`}
              disabled={disabled}
              variant="secondary"
              onPress={() =>
                open({ type: "relative", direction, newPerson: true })
              }
            />
          </View>
        ))}
      </SectionCard>
      <PersonRecordsPanels
        p={p}
        state={state}
        workflow={workflow}
        disabled={disabled}
        open={open}
        submit={submit}
        setConfirmation={setConfirmation}
        onReadStory={setReadStory}
      />
      <SectionCard title="Identity association">
        <Text style={shellStyles.mutedText}>
          {detail.identity_link
            ? `${detail.identity_link.label}${detail.identity_link.active ? "" : " (inactive)"}`
            : "No identity linked."}
        </Text>
        <ActionButton
          label="Link existing identity"
          disabled={disabled || !!detail.identity_link}
          variant="secondary"
          onPress={() => {
            open({ type: "identity" });
            void workflow.identities();
          }}
        />
        <ActionButton
          label={`Unlink identity from ${name}`}
          disabled={disabled || !detail.identity_link}
          variant="danger"
          onPress={() =>
            setConfirmation({
              action: {
                type: "unlinkIdentity",
                personId: p.id,
                originalLink: detail.identity_link,
              },
              label: `Unlink identity from ${name}`,
            })
          }
        />
      </SectionCard>
      <SectionCard title="Protection and archive">
        <TreeTextField
          label="Protection reason"
          value={reason}
          onChange={(value) => {
            setReason(value);
            onDirty(true);
          }}
          disabled={lifecycleDisabled}
        />
        <ActionButton
          label={p.is_locked ? "Unlock person" : "Lock person"}
          disabled={lifecycleDisabled || !reason.trim()}
          variant="secondary"
          onPress={() =>
            setConfirmation({
              action: {
                type: p.is_locked ? "unlock" : "lock",
                personId: p.id,
                reason: reason.trim(),
              },
              label: `${p.is_locked ? "Unlock" : "Lock"} ${name}`,
            })
          }
        />
        <ActionButton
          label={p.archived_at ? "Restore person" : "Archive person"}
          disabled={lifecycleDisabled || p.is_locked}
          variant={p.archived_at ? "secondary" : "danger"}
          onPress={() =>
            setConfirmation({
              action: {
                type: p.archived_at ? "restore" : "archive",
                personId: p.id,
              },
              label: `${p.archived_at ? "Restore" : "Archive"} ${name}`,
            })
          }
        />
      </SectionCard>
      {confirmation ? (
        <SectionCard title="Confirm history change">
          <Text style={formStyles.rowMeta}>
            {confirmation.label}? This changes shared household history, not
            credentials.
          </Text>
          <ActionButton
            label={`Confirm ${confirmation.label}`}
            disabled={
              state.busy ||
              state.loading ||
              !!state.pending ||
              state.toolsPending ||
              !!state.error
            }
            variant="danger"
            onPress={() =>
              void submit(confirmation.action, confirmation.revision)
            }
          />
          <ActionButton
            label="Cancel history change"
            disabled={state.busy}
            variant="secondary"
            onPress={() => setConfirmation(null)}
          />
        </SectionCard>
      ) : null}
    </View>
  );
}
