import { Text, TextInput, View } from "react-native";

import type {
  Child,
  HomeschoolAttendance,
  HomeschoolSubject,
} from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { ChoiceGroup } from "../../../components/ChoiceGroup";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";
import type { AttendanceFormState } from "../lib/defaults";
import { sortDatedRecords } from "../lib/records";
import { ChildPicker, SubjectPicker } from "./HomeschoolPickers";

const attendanceOptions = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
] satisfies Array<{ label: string; value: "present" | "absent" }>;

export function HomeschoolAttendanceSection({
  attendance,
  busy,
  children,
  form,
  subjects,
  onChange,
  onDelete,
  onEdit,
  onSave,
}: {
  attendance: HomeschoolAttendance[];
  busy: boolean;
  children: Child[];
  form: AttendanceFormState;
  subjects: HomeschoolSubject[];
  onChange: (patch: Partial<AttendanceFormState>) => void;
  onDelete: (record: HomeschoolAttendance) => void;
  onEdit: (record: HomeschoolAttendance) => void;
  onSave: () => void;
}) {
  const filteredRecords = form.childId
    ? attendance.filter((record) => record.child_id === Number(form.childId))
    : attendance;
  const recentRecords = sortDatedRecords(filteredRecords).slice(0, 10);
  const subjectLookup = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );

  return (
    <View>
      <SectionCard title="Attendance Entry">
        <ChildPicker
          children={children}
          onChange={(childId) => onChange({ childId })}
          value={form.childId}
        />
        <SubjectPicker
          onChange={(subjectId) => onChange({ subjectId })}
          subjects={subjects}
          value={form.subjectId}
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
        <FieldLabel label="Status" />
        <ChoiceGroup
          disabled={busy}
          onChange={(value) => onChange({ present: value === "present" })}
          options={attendanceOptions}
          value={form.present ? "present" : "absent"}
        />
        <FieldLabel label="Comment" />
        <TextInput
          maxLength={2000}
          multiline
          onChangeText={(comment) => onChange({ comment })}
          placeholder="Fractions, copywork, field trip..."
          placeholderTextColor="#94a3b8"
          style={[styles.input, styles.multilineInput]}
          value={form.comment}
        />
        <ActionButton
          disabled={busy || form.childId === "" || form.subjectId === ""}
          label={busy ? "Saving..." : "Save Attendance"}
          onPress={onSave}
        />
      </SectionCard>

      <SectionCard title="Recent Attendance">
        {recentRecords.length === 0 ? (
          <Text style={styles.mutedText}>No attendance records yet.</Text>
        ) : null}
        {recentRecords.map((record) => (
          <View key={record.id} style={styles.reviewItem}>
            <Text style={styles.rowTitle}>
              {record.date} -{" "}
              {subjectLookup.get(record.subject_id)?.name ??
                `Subject ${record.subject_id}`}
            </Text>
            <Text style={styles.rowMeta}>
              {record.present ? "Present" : "Absent"}
              {record.comment.trim().length > 0 ? ` - ${record.comment}` : ""}
            </Text>
            <View style={styles.inlineButtons}>
              <ActionButton
                compact
                disabled={busy}
                label="Edit"
                onPress={() => onEdit(record)}
                variant="secondary"
              />
              <ActionButton
                compact
                disabled={busy}
                label="Delete"
                onPress={() => onDelete(record)}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
