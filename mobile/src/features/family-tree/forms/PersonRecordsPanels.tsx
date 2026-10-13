import { Text, View } from "react-native";
import type * as FT from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { dateLabel } from "../lib/workflows/view";
import type { TreeAction } from "../lib/workflows/commands";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
import type { Editor } from "./PersonEditors";
export function PersonRecordsPanels({
  p,
  state,
  workflow,
  disabled,
  open,
  submit,
  setConfirmation,
  onReadStory,
}: {
  p: FT.FamilyTreePerson;
  state: TreeState;
  workflow: TreeWorkflow;
  disabled: boolean;
  open: (editor: Editor) => void;
  submit: (action: TreeAction) => Promise<boolean>;
  setConfirmation: (confirmation: {
    action: TreeAction;
    label: string;
  }) => void;
  onReadStory: (story: FT.FamilyTreeStory) => void;
}) {
  async function reorder(index: number, delta: number) {
    if (disabled || state.stories?.next_cursor) return;
    const ids = state.stories!.items.map((s) => s.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await submit({ type: "reorderStories", personId: p.id, storyIds: ids });
  }
  return (
    <>
      <SectionCard title="Stories">
        <ActionButton
          label="Add story"
          disabled={disabled}
          variant="secondary"
          onPress={() => open({ type: "story" })}
        />
        {state.stories?.items.length === 0 ? (
          <Text style={shellStyles.mutedText}>No stories recorded.</Text>
        ) : null}
        {state.stories?.items.map((s, index) => (
          <View key={s.id}>
            <Text style={formStyles.rowTitle}>{s.title}</Text>
            <Text style={shellStyles.mutedText}>
              {dateLabel(s.date)} · Contributor #
              {s.created_by_user_id ?? "removed"}
            </Text>
            <View style={formStyles.inlineButtons}>
              <ActionButton
                label={`Read story: ${s.title}`}
                variant="secondary"
                onPress={() => onReadStory(s)}
              />
              <ActionButton
                label={`Edit story: ${s.title}`}
                disabled={disabled}
                variant="secondary"
                onPress={() => open({ type: "story", record: s })}
              />
              <ActionButton
                label={`Delete story: ${s.title}`}
                disabled={disabled}
                variant="danger"
                onPress={() =>
                  setConfirmation({
                    action: { type: "deleteStory", id: s.id },
                    label: `Delete story: ${s.title}`,
                  })
                }
              />
              <ActionButton
                label={`Move story up: ${s.title}`}
                disabled={
                  disabled || index === 0 || !!state.stories?.next_cursor
                }
                variant="secondary"
                onPress={() => void reorder(index, -1)}
              />
              <ActionButton
                label={`Move story down: ${s.title}`}
                disabled={
                  disabled ||
                  index === (state.stories?.items.length ?? 0) - 1 ||
                  !!state.stories?.next_cursor
                }
                variant="secondary"
                onPress={() => void reorder(index, 1)}
              />
            </View>
          </View>
        ))}
        {state.stories?.next_cursor ? (
          <>
            <Text style={shellStyles.mutedText}>
              Load all story pages before reordering.
            </Text>
            <ActionButton
              label="Load more stories"
              disabled={state.loading || state.busy}
              variant="secondary"
              onPress={() => void workflow.moreStories()}
            />
          </>
        ) : null}
      </SectionCard>
      <SectionCard title="Residences">
        <ActionButton
          label="Add residence"
          disabled={disabled}
          variant="secondary"
          onPress={() => open({ type: "residence" })}
        />
        {state.residences?.items.length === 0 ? (
          <Text style={shellStyles.mutedText}>No residences recorded.</Text>
        ) : null}
        {state.residences?.items.map((r) => (
          <View key={r.id}>
            <Text style={formStyles.rowTitle}>
              {r.place}
              {r.is_primary ? " · Primary" : ""}
            </Text>
            <Text style={shellStyles.mutedText}>
              {dateLabel(r.start_date)} – {dateLabel(r.end_date)} · Contributor
              #{r.created_by_user_id ?? "removed"}
            </Text>
            <Text selectable style={shellStyles.mutedText}>
              {r.notes_md} {r.source_label} {r.source_url}
            </Text>
            <View style={formStyles.inlineButtons}>
              <ActionButton
                label={`Edit residence: ${r.place}`}
                disabled={disabled}
                variant="secondary"
                onPress={() => open({ type: "residence", record: r })}
              />
              <ActionButton
                label={`Make primary: ${r.place}`}
                disabled={disabled || r.is_primary}
                variant="secondary"
                onPress={() =>
                  void submit({
                    type: "patchResidence",
                    id: r.id,
                    changes: { is_primary: true },
                  })
                }
              />
              <ActionButton
                label={`Delete residence: ${r.place}`}
                disabled={disabled}
                variant="danger"
                onPress={() =>
                  setConfirmation({
                    action: { type: "deleteResidence", id: r.id },
                    label: `Delete residence: ${r.place}`,
                  })
                }
              />
            </View>
          </View>
        ))}
        {state.residences?.next_cursor ? (
          <ActionButton
            label="Load more residences"
            disabled={state.loading || state.busy}
            variant="secondary"
            onPress={() => void workflow.moreResidences()}
          />
        ) : null}
      </SectionCard>
    </>
  );
}
