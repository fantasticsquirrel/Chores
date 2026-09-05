import { Text, TextInput, View } from "react-native";

import type {
  Child,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type { GradeFormState } from "../lib/defaults";
import {
  ChildPicker,
  SemesterPicker,
  SubjectPicker,
} from "./HomeschoolPickers";

export function HomeschoolGradeSection({
  busy,
  children,
  form,
  grades,
  semesters,
  subjects,
  onChange,
  onDelete,
  onEdit,
  onSave,
}: {
  busy: boolean;
  children: Child[];
  form: GradeFormState;
  grades: HomeschoolGrade[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  onChange: (patch: Partial<GradeFormState>) => void;
  onDelete: (grade: HomeschoolGrade) => void;
  onEdit: (grade: HomeschoolGrade) => void;
  onSave: () => void;
}) {
  const filteredGrades = form.childId
    ? grades.filter((grade) => grade.child_id === Number(form.childId))
    : grades;
  const subjectLookup = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );
  const semesterLookup = new Map(
    semesters.map((semester) => [semester.id, semester]),
  );

  return (
    <View>
      <SectionCard title="Grade Entry">
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
        <SemesterPicker
          includeOverall
          onChange={(semesterId) => onChange({ semesterId })}
          semesters={semesters}
          value={form.semesterId}
        />
        <FieldLabel label="Grade" />
        <TextInput
          maxLength={64}
          onChangeText={(grade) => onChange({ grade })}
          placeholder="A, 95%, Complete..."
          placeholderTextColor="#94a3b8"
          style={formStyles.input}
          value={form.grade}
        />
        <ActionButton
          disabled={busy || form.childId === "" || form.subjectId === ""}
          label={busy ? "Saving..." : "Save Grade"}
          onPress={onSave}
        />
      </SectionCard>

      <SectionCard title="Grade Records">
        {filteredGrades.length === 0 ? (
          <Text style={shellStyles.mutedText}>No grade records yet.</Text>
        ) : null}
        {filteredGrades.map((grade) => (
          <View key={grade.id} style={cardStyles.reviewItem}>
            <Text style={formStyles.rowTitle}>
              {subjectLookup.get(grade.subject_id)?.name ??
                `Subject ${grade.subject_id}`}
              : {grade.grade || "-"}
            </Text>
            <Text style={formStyles.rowMeta}>
              {grade.semester_id === null
                ? "Overall"
                : (semesterLookup.get(grade.semester_id)?.name ??
                  `Semester ${grade.semester_id}`)}
            </Text>
            <View style={formStyles.inlineButtons}>
              <ActionButton
                compact
                disabled={busy}
                label="Edit"
                onPress={() => onEdit(grade)}
                variant="secondary"
              />
              <ActionButton
                compact
                disabled={busy}
                label="Delete"
                onPress={() => onDelete(grade)}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
