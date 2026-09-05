import { Pressable, Text, View } from "react-native";

import type { Child, HomeschoolSemester } from "../../../api/models";
import { SectionCard } from "../../../components/SectionCard";
import { StatCard } from "../../../components/StatCard";
import { styles } from "../../../styles/layout";
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
      <View style={styles.statGrid}>
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
          <Text style={styles.mutedText}>
            Add an active child before logging school records.
          </Text>
        ) : null}
        {activeChildren.map((child) => (
          <Pressable
            accessibilityRole="button"
            key={child.id}
            onPress={() => onChildSelect(child.id)}
            style={[
              styles.selectableRow,
              selectedChildId === child.id
                ? styles.selectableRowSelected
                : null,
            ]}
          >
            <Text style={styles.rowTitle}>{child.name}</Text>
            <Text
              style={[
                styles.selectionMark,
                selectedChildId === child.id
                  ? styles.selectionMarkSelected
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
          <Text style={styles.mutedText}>
            Create a semester to narrow attendance and grade summaries.
          </Text>
        ) : null}
        {semesters.map((semester) => (
          <Pressable
            accessibilityRole="button"
            key={semester.id}
            onPress={() => onSemesterSelect(semester.id)}
            style={[
              styles.selectableRow,
              selectedSemesterId === semester.id
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
                selectedSemesterId === semester.id
                  ? styles.selectionMarkSelected
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
          <Text style={styles.mutedText}>
            Create subjects to see progress rows.
          </Text>
        ) : null}
        {subjectRows.map((row) => (
          <View key={row.subjectId} style={styles.reviewItem}>
            <View style={styles.splitRow}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{row.name}</Text>
                <Text style={styles.rowMeta}>
                  {row.days} day{row.days === 1 ? "" : "s"} - {row.entries} entr
                  {row.entries === 1 ? "y" : "ies"} - Grade {row.grade}
                </Text>
              </View>
              <View
                style={[styles.rowColorDot, { backgroundColor: row.color }]}
              />
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
