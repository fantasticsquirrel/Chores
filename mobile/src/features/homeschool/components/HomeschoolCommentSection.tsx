import { Text, TextInput, View } from "react-native";

import type { Child, HomeschoolDayComment } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";
import type { DayCommentFormState } from "../lib/defaults";
import { sortDatedRecords } from "../lib/records";
import { ChildPicker } from "./HomeschoolPickers";

export function HomeschoolCommentSection({
  busy,
  children,
  comments,
  form,
  onChange,
  onDelete,
  onEdit,
  onSave,
}: {
  busy: boolean;
  children: Child[];
  comments: HomeschoolDayComment[];
  form: DayCommentFormState;
  onChange: (patch: Partial<DayCommentFormState>) => void;
  onDelete: (comment: HomeschoolDayComment) => void;
  onEdit: (comment: HomeschoolDayComment) => void;
  onSave: () => void;
}) {
  const filteredComments = form.childId
    ? comments.filter((comment) => comment.child_id === Number(form.childId))
    : comments;
  const recentComments = sortDatedRecords(filteredComments).slice(0, 10);

  return (
    <View>
      <SectionCard title="Day Comment">
        <ChildPicker
          children={children}
          onChange={(childId) => onChange({ childId })}
          value={form.childId}
        />
        <FieldLabel label="Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(date) => onChange({ date })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.date}
        />
        <FieldLabel label="Comment" />
        <TextInput
          maxLength={4000}
          multiline
          onChangeText={(comment) => onChange({ comment })}
          placeholder="Field trip, sick day, reading notes..."
          placeholderTextColor="#94a3b8"
          style={[styles.input, styles.multilineInput]}
          value={form.comment}
        />
        <ActionButton
          disabled={busy || form.childId === ""}
          label={busy ? "Saving..." : "Save Comment"}
          onPress={onSave}
        />
      </SectionCard>

      <SectionCard title="Recent Comments">
        {recentComments.length === 0 ? (
          <Text style={styles.mutedText}>No day comments yet.</Text>
        ) : null}
        {recentComments.map((comment) => (
          <View key={comment.id} style={styles.reviewItem}>
            <Text style={styles.rowTitle}>{comment.date}</Text>
            <Text style={styles.rowMeta}>
              {comment.comment || "No comment"}
            </Text>
            <View style={styles.inlineButtons}>
              <ActionButton
                compact
                disabled={busy}
                label="Edit"
                onPress={() => onEdit(comment)}
                variant="secondary"
              />
              <ActionButton
                compact
                disabled={busy}
                label="Delete"
                onPress={() => onDelete(comment)}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
