import { Text, View } from "react-native";
import type * as FT from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { InlineNotice } from "../../../components/InlineNotice";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { NativeEditor, TreeTextField } from "./NativeEditor";
import {
  PeoplePicker,
  RelativeEditor,
  RelationshipEditor,
} from "./Relationships";
import {
  personFields,
  residenceFields,
  storyFields,
  type Direction,
} from "./payload";
import { dateLabel, personName } from "../lib/workflows/view";
import type { TreeAction } from "../lib/workflows/commands";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
export type Editor = (
  | { type: "person" }
  | { type: "story"; record?: FT.FamilyTreeStory }
  | { type: "residence"; record?: FT.FamilyTreeResidence }
  | { type: "relative"; direction: Direction; newPerson: boolean }
  | {
      type: "relationship";
      kind: "parent" | "care" | "partner";
      record:
        | FT.FamilyTreeParentLink
        | FT.FamilyTreeCareLink
        | FT.FamilyTreePartnerEpisode;
    }
  | { type: "identity" }
  | { type: "compare" }
) & { originRevision?: number };
export function PersonEditors({
  editor,
  state,
  workflow,
  onDirty,
  p,
  name,
  disabled,
  manager,
  people,
  more,
  search,
  submit,
  candidate,
  setCandidate,
  editCancel,
}: {
  editor: Editor;
  state: TreeState;
  workflow: TreeWorkflow;
  onDirty: (dirty: boolean) => void;
  p: FT.FamilyTreePerson;
  name: string;
  disabled: boolean;
  manager: boolean;
  people: FT.FamilyTreePerson[];
  more?: () => void;
  search: (query: string) => void;
  submit: (action: TreeAction) => Promise<boolean>;
  candidate: FT.FamilyTreeIdentityCandidate | null;
  setCandidate: (candidate: FT.FamilyTreeIdentityCandidate) => void;
  editCancel: () => void;
}) {
  return (
    <View>
      {editor.type === "person" ? (
        <NativeEditor
          title={`Edit ${name}`}
          fields={personFields}
          initial={p}
          patch
          disabled={disabled}
          onDirty={onDirty}
          onSubmit={(changes) =>
            submit({
              type: "patchPerson",
              personId: p.id,
              changes: changes as FT.FamilyTreePersonChanges,
            })
          }
        />
      ) : null}
      {editor.type === "story" ? (
        <NativeEditor
          title={
            editor.record ? `Edit story: ${editor.record.title}` : "Add story"
          }
          fields={storyFields}
          initial={editor.record}
          patch={!!editor.record}
          disabled={disabled}
          onDirty={onDirty}
          onSubmit={(data) =>
            editor.record
              ? submit({
                  type: "patchStory",
                  id: editor.record.id,
                  changes: data as FT.FamilyTreeStoryChanges,
                })
              : submit({
                  type: "createStory",
                  personId: p.id,
                  story: data as unknown as FT.FamilyTreeStoryInput,
                })
          }
        />
      ) : null}
      {editor.type === "residence" ? (
        <NativeEditor
          title={
            editor.record
              ? `Edit residence: ${editor.record.place}`
              : "Add residence"
          }
          fields={residenceFields}
          initial={editor.record}
          patch={!!editor.record}
          disabled={disabled}
          onDirty={onDirty}
          onSubmit={(data) =>
            editor.record
              ? submit({
                  type: "patchResidence",
                  id: editor.record.id,
                  changes: data as FT.FamilyTreeResidenceChanges,
                })
              : submit({
                  type: "createResidence",
                  personId: p.id,
                  residence: data as unknown as FT.FamilyTreeResidenceInput,
                })
          }
        />
      ) : null}
      {editor.type === "relative" ? (
        <RelativeEditor
          direction={editor.direction}
          newPerson={editor.newPerson}
          personId={p.id}
          people={people}
          disabled={disabled}
          onDirty={onDirty}
          onSubmit={submit}
          onSearch={search}
          onMore={more}
        />
      ) : null}
      {editor.type === "relationship" ? (
        <RelationshipEditor
          type={editor.kind}
          record={editor.record}
          people={people}
          disabled={disabled}
          onDirty={onDirty}
          onSubmit={submit}
          onSearch={search}
          onMore={more}
        />
      ) : null}
      {editor.type === "identity" ? (
        <View>
          <Text style={shellStyles.mutedText}>
            An identity link does not create ancestry, rename profiles or change
            credentials.
          </Text>
          {state.candidates.length === 0 ? (
            <Text style={shellStyles.mutedText}>
              {state.loading
                ? "Loading eligible identities…"
                : "No eligible identities returned."}
            </Text>
          ) : (
            state.candidates.map((c) => (
              <ActionButton
                key={`${c.kind}:${c.id}`}
                label={`Select ${c.kind}: ${c.label}`}
                disabled={disabled || !c.active}
                variant="secondary"
                onPress={() => {
                  setCandidate(c);
                  onDirty(true);
                }}
              />
            ))
          )}
          {candidate ? (
            <>
              <Text style={formStyles.rowMeta}>
                Confirm that {name} is the person associated with{" "}
                {candidate.label}.
              </Text>
              <ActionButton
                label={`Confirm link ${name} to ${candidate.label}`}
                disabled={disabled}
                onPress={() =>
                  void submit({
                    type: "linkIdentity",
                    personId: p.id,
                    candidate,
                    confirmed: true,
                  })
                }
              />
            </>
          ) : null}
          <ActionButton
            label="Refresh eligible identities"
            disabled={state.loading || state.busy || !manager}
            variant="secondary"
            onPress={() => void workflow.identities()}
          />
        </View>
      ) : null}
      {editor.type === "compare" ? (
        <>
          <PeoplePicker
            label="Compare person"
            people={people.filter((other) => other.id !== p.id)}
            selected={state.compare?.person_b_id ?? null}
            disabled={state.loading || state.busy}
            onPick={(id) => void workflow.compareWith(id)}
            onSearch={search}
            onMore={more}
          />
          {state.compare ? (
            <SectionCard title="Recorded connection">
              <Text style={formStyles.rowMeta}>
                {state.compare.state === "connected"
                  ? `Connected by ${state.compare.distance} recorded connections`
                  : state.compare.state === "truncated"
                    ? "Search limit reached — connection not determined"
                    : "No recorded connection found"}
              </Text>
              {state.compare.path.map((e) => (
                <Text key={e.id} style={shellStyles.mutedText}>
                  Person #{e.source_person_id} → Person #{e.target_person_id}:{" "}
                  {e.type} · {e.kind.replace(/_/g, " ")}
                  {e.status ? ` · ${e.status}` : ""} · {dateLabel(e.start_date)}{" "}
                  – {dateLabel(e.end_date)}
                </Text>
              ))}
              {state.compare.warnings.map((w, i) => (
                <Text key={i} style={shellStyles.mutedText}>
                  {w}
                </Text>
              ))}
              <Text style={shellStyles.mutedText}>
                Recorded paths are not inferred kinship or legal determinations.
              </Text>
            </SectionCard>
          ) : null}
        </>
      ) : null}
      <ActionButton
        label="Cancel editing"
        disabled={state.busy}
        variant="secondary"
        onPress={editCancel}
      />
    </View>
  );
}
