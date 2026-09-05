import { Text, TextInput, View } from "react-native";

import type { HomeschoolSemester } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";
import type { SemesterFormState } from "../lib/defaults";
import { ToggleRow } from "./HomeschoolPickers";

type SemesterFormSectionProps = {
  busy: boolean;
  editingSemesterId: number | null;
  form: SemesterFormState;
  onCancelEdit: () => void;
  onChange: (patch: Partial<SemesterFormState>) => void;
  onSave: () => void;
};

type SemesterListSectionProps = {
  busy: boolean;
  semesters: HomeschoolSemester[];
  onDelete: (semester: HomeschoolSemester) => void;
  onEdit: (semester: HomeschoolSemester) => void;
};

export function HomeschoolSemesterSection(
  props: SemesterFormSectionProps & SemesterListSectionProps,
) {
  return (
    <View>
      <HomeschoolSemesterFormSection {...props} />
      <HomeschoolSemesterListSection {...props} />
    </View>
  );
}

export function HomeschoolSemesterFormSection({
  busy,
  editingSemesterId,
  form,
  onCancelEdit,
  onChange,
  onSave,
}: SemesterFormSectionProps) {
  return (
    <SectionCard
      subtitle={
        editingSemesterId === null
          ? "Create reusable terms"
          : "Editing selected term"
      }
      title={editingSemesterId === null ? "New Semester" : "Edit Semester"}
    >
      <FieldLabel label="Name" />
      <TextInput
        maxLength={255}
        onChangeText={(name) => onChange({ name })}
        placeholder="Fall 2026"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={form.name}
      />
      <FieldLabel label="Start Date" />
      <TextInput
        autoCapitalize="none"
        onChangeText={(start_date) => onChange({ start_date })}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={form.start_date}
      />
      <FieldLabel label="End Date" />
      <TextInput
        autoCapitalize="none"
        onChangeText={(end_date) => onChange({ end_date })}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={form.end_date}
      />
      <ToggleRow
        enabled={form.active}
        label="Active semester"
        onToggle={() => onChange({ active: !form.active })}
      />
      <View style={styles.inlineButtons}>
        <ActionButton
          compact
          disabled={busy || form.name.trim().length === 0}
          label={editingSemesterId === null ? "Create" : "Update"}
          onPress={onSave}
        />
        {editingSemesterId !== null ? (
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

export function HomeschoolSemesterListSection({
  busy,
  semesters,
  onDelete,
  onEdit,
}: SemesterListSectionProps) {
  return (
    <SectionCard title="Semesters">
      {semesters.length === 0 ? (
        <Text style={styles.mutedText}>
          No semesters have been created yet.
        </Text>
      ) : null}
      {semesters.map((semester) => (
        <View key={semester.id} style={styles.reviewItem}>
          <Text style={styles.rowTitle}>{semester.name}</Text>
          <Text style={styles.rowMeta}>
            {semester.start_date} to {semester.end_date} -{" "}
            {semester.active ? "active" : "inactive"}
          </Text>
          <View style={styles.inlineButtons}>
            <ActionButton
              compact
              disabled={busy}
              label="Edit"
              onPress={() => onEdit(semester)}
              variant="secondary"
            />
            <ActionButton
              compact
              disabled={busy}
              label="Delete"
              onPress={() => onDelete(semester)}
              variant="danger"
            />
          </View>
        </View>
      ))}
    </SectionCard>
  );
}
