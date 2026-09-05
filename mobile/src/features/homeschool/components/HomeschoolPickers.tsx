import { Pressable, Text, View } from "react-native";

import type {
  Child,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { FieldLabel } from "../../../components/FieldLabel";
import { styles } from "../../../styles/layout";

export function ChildPicker({
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
        <Text style={styles.mutedText}>
          Create a child before logging records.
        </Text>
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

export function SubjectPicker({
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
        <Text style={styles.mutedText}>
          Create a subject before logging records.
        </Text>
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
              style={[styles.rowColorDot, { backgroundColor: subject.color }]}
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

export function SemesterPicker({
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

export function ToggleRow({
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
      style={[
        styles.selectableRow,
        enabled ? styles.selectableRowSelected : null,
      ]}
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
