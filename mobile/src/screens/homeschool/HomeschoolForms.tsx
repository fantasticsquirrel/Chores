import { Pressable, Text, TextInput, View } from "react-native";

import type {
  Child,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FieldLabel } from "../../components/FieldLabel";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import {
  sortDatedRecords,
  subjectColorSwatches,
} from "./homeschoolLogic";

export type SemesterFormState = {
  active: boolean;
  end_date: string;
  name: string;
  start_date: string;
};

export type SubjectFormState = {
  active: boolean;
  color: string;
  name: string;
};

export type AttendanceFormState = {
  childId: string;
  comment: string;
  date: string;
  present: boolean;
  subjectId: string;
};

export type DayCommentFormState = {
  childId: string;
  comment: string;
  date: string;
};

export type GradeFormState = {
  childId: string;
  grade: string;
  semesterId: string;
  subjectId: string;
};

const attendanceOptions = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
] satisfies Array<{ label: string; value: "present" | "absent" }>;

export function HomeschoolSetupSection({
  busy,
  editingSemesterId,
  editingSubjectId,
  semesterForm,
  semesters,
  subjectForm,
  subjects,
  onCancelSemesterEdit,
  onCancelSubjectEdit,
  onDeleteSemester,
  onDeleteSubject,
  onEditSemester,
  onEditSubject,
  onSaveSemester,
  onSaveSubject,
  onSemesterChange,
  onSubjectChange,
}: {
  busy: boolean;
  editingSemesterId: number | null;
  editingSubjectId: number | null;
  semesterForm: SemesterFormState;
  semesters: HomeschoolSemester[];
  subjectForm: SubjectFormState;
  subjects: HomeschoolSubject[];
  onCancelSemesterEdit: () => void;
  onCancelSubjectEdit: () => void;
  onDeleteSemester: (semester: HomeschoolSemester) => void;
  onDeleteSubject: (subject: HomeschoolSubject) => void;
  onEditSemester: (semester: HomeschoolSemester) => void;
  onEditSubject: (subject: HomeschoolSubject) => void;
  onSaveSemester: () => void;
  onSaveSubject: () => void;
  onSemesterChange: (patch: Partial<SemesterFormState>) => void;
  onSubjectChange: (patch: Partial<SubjectFormState>) => void;
}) {
  return (
    <View>
      <SectionCard
        subtitle={editingSemesterId === null ? "Create reusable terms" : "Editing selected term"}
        title={editingSemesterId === null ? "New Semester" : "Edit Semester"}
      >
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={(name) => onSemesterChange({ name })}
          placeholder="Fall 2026"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={semesterForm.name}
        />
        <FieldLabel label="Start Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(start_date) => onSemesterChange({ start_date })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={semesterForm.start_date}
        />
        <FieldLabel label="End Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(end_date) => onSemesterChange({ end_date })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={semesterForm.end_date}
        />
        <ToggleRow
          enabled={semesterForm.active}
          label="Active semester"
          onToggle={() => onSemesterChange({ active: !semesterForm.active })}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={busy || semesterForm.name.trim().length === 0}
            label={editingSemesterId === null ? "Create" : "Update"}
            onPress={onSaveSemester}
          />
          {editingSemesterId !== null ? (
            <ActionButton
              compact
              disabled={busy}
              label="Cancel"
              onPress={onCancelSemesterEdit}
              variant="secondary"
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard
        subtitle={editingSubjectId === null ? "Create reusable subjects" : "Editing selected subject"}
        title={editingSubjectId === null ? "New Subject" : "Edit Subject"}
      >
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={(name) => onSubjectChange({ name })}
          placeholder="Math"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={subjectForm.name}
        />
        <FieldLabel label="Color" />
        <TextInput
          autoCapitalize="none"
          maxLength={32}
          onChangeText={(color) => onSubjectChange({ color })}
          placeholder="#3b82f6"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={subjectForm.color}
        />
        <View style={styles.swatchRow}>
          {subjectColorSwatches.map((color) => (
            <Pressable
              accessibilityLabel={`Use ${color}`}
              accessibilityRole="button"
              key={color}
              onPress={() => onSubjectChange({ color })}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                subjectForm.color.trim().toLowerCase() === color
                  ? styles.colorSwatchSelected
                  : null,
              ]}
            />
          ))}
        </View>
        <ToggleRow
          enabled={subjectForm.active}
          label="Active subject"
          onToggle={() => onSubjectChange({ active: !subjectForm.active })}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={busy || subjectForm.name.trim().length === 0}
            label={editingSubjectId === null ? "Create" : "Update"}
            onPress={onSaveSubject}
          />
          {editingSubjectId !== null ? (
            <ActionButton
              compact
              disabled={busy}
              label="Cancel"
              onPress={onCancelSubjectEdit}
              variant="secondary"
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Semesters">
        {semesters.length === 0 ? (
          <Text style={styles.mutedText}>No semesters have been created yet.</Text>
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
                onPress={() => onEditSemester(semester)}
                variant="secondary"
              />
              <ActionButton
                compact
                disabled={busy}
                label="Delete"
                onPress={() => onDeleteSemester(semester)}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </SectionCard>

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
                style={[
                  styles.rowColorDot,
                  { backgroundColor: subject.color },
                ]}
              />
            </View>
            <View style={styles.inlineButtons}>
              <ActionButton
                compact
                disabled={busy}
                label="Edit"
                onPress={() => onEditSubject(subject)}
                variant="secondary"
              />
              <ActionButton
                compact
                disabled={busy}
                label="Delete"
                onPress={() => onDeleteSubject(subject)}
                variant="danger"
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

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
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));

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

export function HomeschoolCommentsSection({
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
            <Text style={styles.rowMeta}>{comment.comment || "No comment"}</Text>
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

export function HomeschoolGradesSection({
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
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
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
          style={styles.input}
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
          <Text style={styles.mutedText}>No grade records yet.</Text>
        ) : null}
        {filteredGrades.map((grade) => (
          <View key={grade.id} style={styles.reviewItem}>
            <Text style={styles.rowTitle}>
              {subjectLookup.get(grade.subject_id)?.name ??
                `Subject ${grade.subject_id}`}
              : {grade.grade || "-"}
            </Text>
            <Text style={styles.rowMeta}>
              {grade.semester_id === null
                ? "Overall"
                : semesterLookup.get(grade.semester_id)?.name ??
                  `Semester ${grade.semester_id}`}
            </Text>
            <View style={styles.inlineButtons}>
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

function ChildPicker({
  children,
  onChange,
  value,
}: {
  children: Child[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View>
      <FieldLabel label="Child" />
      {children.length === 0 ? (
        <Text style={styles.mutedText}>Create a child before logging records.</Text>
      ) : null}
      {children.map((child) => (
        <Pressable
          accessibilityRole="button"
          key={child.id}
          onPress={() => onChange(child.id.toString())}
          style={[
            styles.selectableRow,
            value === child.id.toString() ? styles.selectableRowSelected : null,
          ]}
        >
          <Text style={styles.rowTitle}>{child.name}</Text>
          <Text
            style={[
              styles.selectionMark,
              value === child.id.toString()
                ? styles.selectionMarkSelected
                : null,
            ]}
          >
            {value === child.id.toString() ? "Selected" : "Select"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SubjectPicker({
  onChange,
  subjects,
  value,
}: {
  onChange: (value: string) => void;
  subjects: HomeschoolSubject[];
  value: string;
}) {
  return (
    <View>
      <FieldLabel label="Subject" />
      {subjects.length === 0 ? (
        <Text style={styles.mutedText}>Create a subject before logging records.</Text>
      ) : null}
      {subjects.map((subject) => (
        <Pressable
          accessibilityRole="button"
          key={subject.id}
          onPress={() => onChange(subject.id.toString())}
          style={[
            styles.selectableRow,
            value === subject.id.toString()
              ? styles.selectableRowSelected
              : null,
          ]}
        >
          <View style={styles.splitRow}>
            <View
              style={[
                styles.rowColorDot,
                { backgroundColor: subject.color },
              ]}
            />
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{subject.name}</Text>
              <Text style={styles.rowMeta}>
                {subject.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.selectionMark,
              value === subject.id.toString()
                ? styles.selectionMarkSelected
                : null,
            ]}
          >
            {value === subject.id.toString() ? "Selected" : "Select"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SemesterPicker({
  includeOverall,
  onChange,
  semesters,
  value,
}: {
  includeOverall?: boolean;
  onChange: (value: string) => void;
  semesters: HomeschoolSemester[];
  value: string;
}) {
  return (
    <View>
      <FieldLabel label="Semester" />
      {includeOverall ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange("")}
          style={[
            styles.selectableRow,
            value === "" ? styles.selectableRowSelected : null,
          ]}
        >
          <Text style={styles.rowTitle}>Overall</Text>
          <Text
            style={[
              styles.selectionMark,
              value === "" ? styles.selectionMarkSelected : null,
            ]}
          >
            {value === "" ? "Selected" : "Select"}
          </Text>
        </Pressable>
      ) : null}
      {semesters.map((semester) => (
        <Pressable
          accessibilityRole="button"
          key={semester.id}
          onPress={() => onChange(semester.id.toString())}
          style={[
            styles.selectableRow,
            value === semester.id.toString()
              ? styles.selectableRowSelected
              : null,
          ]}
        >
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>{semester.name}</Text>
            <Text style={styles.rowMeta}>
              {semester.start_date} to {semester.end_date}
            </Text>
          </View>
          <Text
            style={[
              styles.selectionMark,
              value === semester.id.toString()
                ? styles.selectionMarkSelected
                : null,
            ]}
          >
            {value === semester.id.toString() ? "Selected" : "Select"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ToggleRow({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      style={[styles.selectableRow, enabled ? styles.selectableRowSelected : null]}
    >
      <Text style={styles.rowTitle}>{label}</Text>
      <Text
        style={[
          styles.selectionMark,
          enabled ? styles.selectionMarkSelected : null,
        ]}
      >
        {enabled ? "Yes" : "No"}
      </Text>
    </Pressable>
  );
}
