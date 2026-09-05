import { Pressable, Text, View } from "react-native";

import type {
  Child,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";
import { FieldLabel } from "../../../components/FieldLabel";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { homeschoolStyles } from "../styles";

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
        <Text style={shellStyles.mutedText}>
          Create a child before logging records.
        </Text>
      ) : null}
      {children.map((child) => (
        <Pressable
          accessibilityRole="button"
          key={child.id}
          onPress={() => onChange(child.id.toString())}
          style={[
            formStyles.selectableRow,
            value === child.id.toString() ? formStyles.selectableRowSelected : null,
          ]}
        >
          <Text style={formStyles.rowTitle}>{child.name}</Text>
          <Text
            style={[
              formStyles.selectionMark,
              value === child.id.toString()
                ? formStyles.selectionMarkSelected
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
        <Text style={shellStyles.mutedText}>
          Create a subject before logging records.
        </Text>
      ) : null}
      {subjects.map((subject) => (
        <Pressable
          accessibilityRole="button"
          key={subject.id}
          onPress={() => onChange(subject.id.toString())}
          style={[
            formStyles.selectableRow,
            value === subject.id.toString()
              ? formStyles.selectableRowSelected
              : null,
          ]}
        >
          <View style={shellStyles.splitRow}>
            <View
              style={[homeschoolStyles.rowColorDot, { backgroundColor: subject.color }]}
            />
            <View style={formStyles.rowMain}>
              <Text style={formStyles.rowTitle}>{subject.name}</Text>
              <Text style={formStyles.rowMeta}>
                {subject.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
          <Text
            style={[
              formStyles.selectionMark,
              value === subject.id.toString()
                ? formStyles.selectionMarkSelected
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
            formStyles.selectableRow,
            value === "" ? formStyles.selectableRowSelected : null,
          ]}
        >
          <Text style={formStyles.rowTitle}>Overall</Text>
          <Text
            style={[
              formStyles.selectionMark,
              value === "" ? formStyles.selectionMarkSelected : null,
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
            formStyles.selectableRow,
            value === semester.id.toString()
              ? formStyles.selectableRowSelected
              : null,
          ]}
        >
          <View style={formStyles.rowMain}>
            <Text style={formStyles.rowTitle}>{semester.name}</Text>
            <Text style={formStyles.rowMeta}>
              {semester.start_date} to {semester.end_date}
            </Text>
          </View>
          <Text
            style={[
              formStyles.selectionMark,
              value === semester.id.toString()
                ? formStyles.selectionMarkSelected
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
        formStyles.selectableRow,
        enabled ? formStyles.selectableRowSelected : null,
      ]}
    >
      <Text style={formStyles.rowTitle}>{label}</Text>
      <Text
        style={[
          formStyles.selectionMark,
          enabled ? formStyles.selectionMarkSelected : null,
        ]}
      >
        {enabled ? "Yes" : "No"}
      </Text>
    </Pressable>
  );
}
