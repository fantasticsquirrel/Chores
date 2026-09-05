import { Pressable, Text, View } from "react-native";

import type { Child, HomeschoolSemester } from "../../../api/models";
import { SectionCard } from "../../../components/SectionCard";
import { StatCard } from "../../../components/StatCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { homeschoolStyles } from "../styles";
import type { SubjectSummaryRow } from "../lib/records";

export function HomeschoolOverview({
  activeChildren,
  commentsInSemester,
  grades,
  selectedChild,
  selectedChildId,
  selectedSemester,
  selectedSemesterId,
  semesters,
  subjectRows,
  totalAttendanceEntries,
  uniqueAttendanceDays,
  onChildSelect,
  onSemesterSelect,
}: {
  activeChildren: Child[];
  commentsInSemester: number;
  grades: number;
  selectedChild: Child | null;
  selectedChildId: number | null;
  selectedSemester: HomeschoolSemester | null;
  selectedSemesterId: number | null;
  semesters: HomeschoolSemester[];
  subjectRows: SubjectSummaryRow[];
  totalAttendanceEntries: number;
  uniqueAttendanceDays: number;
  onChildSelect: (childId: number) => void;
  onSemesterSelect: (semesterId: number) => void;
}) {
  return (
    <View>
      <View style={cardStyles.statGrid}>
        <StatCard label="Days" value={uniqueAttendanceDays.toString()} />
        <StatCard label="Entries" value={totalAttendanceEntries.toString()} />
        <StatCard label="Notes" value={commentsInSemester.toString()} />
        <StatCard label="Grades" value={grades.toString()} />
      </View>

      <SectionCard
        subtitle={selectedChild?.name ?? "Select a child"}
        title="Selected Child"
      >
        {activeChildren.length === 0 ? (
          <Text style={shellStyles.mutedText}>
            Add an active child before logging school records.
          </Text>
        ) : null}
        {activeChildren.map((child) => (
          <Pressable
            accessibilityRole="button"
            key={child.id}
            onPress={() => onChildSelect(child.id)}
            style={[
              formStyles.selectableRow,
              selectedChildId === child.id
                ? formStyles.selectableRowSelected
                : null,
            ]}
          >
            <Text style={formStyles.rowTitle}>{child.name}</Text>
            <Text
              style={[
                formStyles.selectionMark,
                selectedChildId === child.id
                  ? formStyles.selectionMarkSelected
                  : null,
              ]}
            >
              {selectedChildId === child.id ? "Selected" : "Select"}
            </Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard
        subtitle={
          selectedSemester === null
            ? "Overall"
            : `${selectedSemester.start_date} to ${selectedSemester.end_date}`
        }
        title="Summary Range"
      >
        {semesters.length === 0 ? (
          <Text style={shellStyles.mutedText}>
            Create a semester to narrow attendance and grade summaries.
          </Text>
        ) : null}
        {semesters.map((semester) => (
          <Pressable
            accessibilityRole="button"
            key={semester.id}
            onPress={() => onSemesterSelect(semester.id)}
            style={[
              formStyles.selectableRow,
              selectedSemesterId === semester.id
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
                selectedSemesterId === semester.id
                  ? formStyles.selectionMarkSelected
                  : null,
              ]}
            >
              {selectedSemesterId === semester.id ? "Selected" : "Select"}
            </Text>
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Subject Progress">
        {subjectRows.length === 0 ? (
          <Text style={shellStyles.mutedText}>
            Create subjects to see progress rows.
          </Text>
        ) : null}
        {subjectRows.map((row) => (
          <View key={row.subjectId} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{row.name}</Text>
                <Text style={formStyles.rowMeta}>
                  {row.days} day{row.days === 1 ? "" : "s"} - {row.entries} entr
                  {row.entries === 1 ? "y" : "ies"} - Grade {row.grade}
                </Text>
              </View>
              <View
                style={[homeschoolStyles.rowColorDot, { backgroundColor: row.color }]}
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
