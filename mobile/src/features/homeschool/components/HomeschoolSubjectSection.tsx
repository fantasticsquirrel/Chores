import { Pressable, Text, TextInput, View } from "react-native";

import type { HomeschoolSubject } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";
import type { SubjectFormState } from "../lib/defaults";
import { subjectColorSwatches } from "../lib/options";
import { ToggleRow } from "./HomeschoolPickers";

type SubjectFormSectionProps = {
  busy: boolean;
  editingSubjectId: number | null;
  form: SubjectFormState;
  onCancelEdit: () => void;
  onChange: (patch: Partial<SubjectFormState>) => void;
  onSave: () => void;
};

type SubjectListSectionProps = {
  busy: boolean;
  subjects: HomeschoolSubject[];
  onDelete: (subject: HomeschoolSubject) => void;
  onEdit: (subject: HomeschoolSubject) => void;
};

export function HomeschoolSubjectSection(
  props: SubjectFormSectionProps & SubjectListSectionProps,
) {
  return (
    <View>
      <HomeschoolSubjectFormSection {...props} />
      <HomeschoolSubjectListSection {...props} />
    </View>
  );
}

export function HomeschoolSubjectFormSection({
  busy,
  editingSubjectId,
  form,
  onCancelEdit,
  onChange,
  onSave,
}: SubjectFormSectionProps) {
  return (
    <SectionCard
      subtitle={
        editingSubjectId === null
          ? "Create reusable subjects"
          : "Editing selected subject"
      }
      title={editingSubjectId === null ? "New Subject" : "Edit Subject"}
    >
      <FieldLabel label="Name" />
      <TextInput
        maxLength={255}
        onChangeText={(name) => onChange({ name })}
        placeholder="Math"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={form.name}
      />
      <FieldLabel label="Color" />
      <TextInput
        autoCapitalize="none"
        maxLength={32}
        onChangeText={(color) => onChange({ color })}
        placeholder="#3b82f6"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={form.color}
      />
      <View style={styles.swatchRow}>
        {subjectColorSwatches.map((color) => (
          <Pressable
            accessibilityLabel={`Use ${color}`}
            accessibilityRole="button"
            key={color}
            onPress={() => onChange({ color })}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              form.color.trim().toLowerCase() === color
                ? styles.colorSwatchSelected
                : null,
            ]}
          />
        ))}
      </View>
      <ToggleRow
        enabled={form.active}
        label="Active subject"
        onToggle={() => onChange({ active: !form.active })}
      />
      <View style={styles.inlineButtons}>
        <ActionButton
          compact
          disabled={busy || form.name.trim().length === 0}
          label={editingSubjectId === null ? "Create" : "Update"}
          onPress={onSave}
        />
        {editingSubjectId !== null ? (
          <ActionButton
            compact
            disabled={busy}
            label="Cancel"
            onPress={onCancelEdit}
            variant="secondary"
          />
        ) : null}
      </View>
    </SectionCard>
  );
}

export function HomeschoolSubjectListSection({
  busy,
  subjects,
  onDelete,
  onEdit,
}: SubjectListSectionProps) {
  return (
    <SectionCard title="Subjects">
      {subjects.length === 0 ? (
        <Text style={styles.mutedText}>No subjects have been created yet.</Text>
      ) : null}
      {subjects.map((subject) => (
        <View key={subject.id} style={styles.reviewItem}>
          <View style={styles.splitRow}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{subject.name}</Text>
              <Text style={styles.rowMeta}>
                {subject.color} - {subject.active ? "active" : "inactive"}
              </Text>
            </View>
            <View
              style={[styles.rowColorDot, { backgroundColor: subject.color }]}
            />
          </View>
          <View style={styles.inlineButtons}>
            <ActionButton
              compact
              disabled={busy}
              label="Edit"
              onPress={() => onEdit(subject)}
              variant="secondary"
            />
            <ActionButton
              compact
              disabled={busy}
              label="Delete"
              onPress={() => onDelete(subject)}
              variant="danger"
            />
          </View>
        </View>
      ))}
    </SectionCard>
  );
}
