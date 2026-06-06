import { Pressable, Text, View } from "react-native";

import type {
  Child,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolSubject,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { todayDateString } from "../../utils/date";
import {
  buildCalendarDaySummaries,
  formatYearMonth,
  shiftYearMonth,
  toYearMonth,
} from "./homeschoolLogic";

export function HomeschoolCalendarScreen({
  activeChildren,
  calendarYearMonth,
  selectedChildAttendance,
  selectedChildComments,
  selectedChildId,
  selectedDate,
  subjects,
  onChildChange,
  onDateSelect,
  onDeleteAttendance,
  onDeleteComment,
  onEditAttendance,
  onEditComment,
  onMonthChange,
  onOpenAttendance,
  onOpenComments,
}: {
  activeChildren: Child[];
  calendarYearMonth: string;
  selectedChildAttendance: HomeschoolAttendance[];
  selectedChildComments: HomeschoolDayComment[];
  selectedChildId: number | null;
  selectedDate: string;
  subjects: HomeschoolSubject[];
  onChildChange: (childId: number) => void;
  onDateSelect: (date: string) => void;
  onDeleteAttendance: (record: HomeschoolAttendance) => void;
  onDeleteComment: (comment: HomeschoolDayComment) => void;
  onEditAttendance: (record: HomeschoolAttendance) => void;
  onEditComment: (comment: HomeschoolDayComment) => void;
  onMonthChange: (yearMonth: string) => void;
  onOpenAttendance: () => void;
  onOpenComments: () => void;
}) {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const daySummaries = buildCalendarDaySummaries({
    attendance: selectedChildAttendance,
    comments: selectedChildComments,
    subjects,
    yearMonth: calendarYearMonth,
  });
  const selectedDayAttendance = selectedChildAttendance.filter(
    (record) => record.date === selectedDate,
  );
  const selectedDayComment =
    selectedChildComments.find((comment) => comment.date === selectedDate) ??
    null;

  return (
    <View>
      <SectionCard
        subtitle={selectedChildId === null ? "Choose a child" : undefined}
        title="Calendar Review"
      >
        <FieldLabel label="Child" />
        <View style={styles.compactStack}>
          {activeChildren.length === 0 ? (
            <Text style={styles.mutedText}>No active children found.</Text>
          ) : (
            activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => onChildChange(child.id)}
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
            ))
          )}
        </View>

        <View style={styles.divider} />
        <View style={styles.splitRow}>
          <Text style={styles.cardTitle}>{formatYearMonth(calendarYearMonth)}</Text>
        </View>
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            label="Previous"
            onPress={() =>
              onMonthChange(shiftYearMonth(calendarYearMonth, -1))
            }
            variant="secondary"
          />
          <ActionButton
            compact
            label="Today"
            onPress={() => {
              const today = todayDateString();
              onMonthChange(toYearMonth(today));
              onDateSelect(today);
            }}
            variant="secondary"
          />
          <ActionButton
            compact
            label="Next"
            onPress={() => onMonthChange(shiftYearMonth(calendarYearMonth, 1))}
            variant="secondary"
          />
        </View>

        <View style={styles.calendarWeekRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.calendarWeekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {daySummaries.map((day) => {
            const selected = day.iso === selectedDate;
            return (
              <Pressable
                accessibilityRole="button"
                key={day.iso}
                onPress={() => onDateSelect(day.iso)}
                style={[
                  styles.calendarCell,
                  !day.inMonth ? styles.calendarCellMuted : null,
                  selected ? styles.calendarCellSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.calendarCellText,
                    !day.inMonth ? styles.calendarCellTextMuted : null,
                    selected ? styles.calendarCellTextSelected : null,
                  ]}
                >
                  {day.day}
                  {day.comment !== null ? "*" : ""}
                </Text>
                {day.presentCount > 0 ? (
                  <View style={styles.calendarSubjectRow}>
                    {day.subjectInitials.map((initial, index) => (
                      <Text
                        key={`${day.iso}-${initial}-${index}`}
                        style={[
                          styles.calendarSubjectInitial,
                          selected
                            ? styles.calendarSubjectInitialSelected
                            : null,
                        ]}
                      >
                        {initial}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard subtitle={selectedDate} title="Day Detail">
        {selectedChildId === null ? (
          <Text style={styles.mutedText}>Select a child to review this day.</Text>
        ) : null}
        {selectedChildId !== null && selectedDayAttendance.length === 0 ? (
          <Text style={styles.mutedText}>No attendance entries for this day.</Text>
        ) : null}
        {selectedDayAttendance.map((record) => {
          const subject = subjectLookup.get(record.subject_id);
          return (
            <View key={record.id} style={styles.reviewItem}>
              <Text style={styles.rowTitle}>
                {subject?.name ?? `Subject ${record.subject_id}`}
              </Text>
              <Text style={styles.rowMeta}>
                {record.present ? "Present" : "Not present"}
                {record.comment.trim().length > 0
                  ? ` - ${record.comment}`
                  : ""}
              </Text>
              <View style={styles.inlineButtons}>
                <ActionButton
                  compact
                  label="Edit"
                  onPress={() => onEditAttendance(record)}
                  variant="secondary"
                />
                <ActionButton
                  compact
                  label="Delete"
                  onPress={() => onDeleteAttendance(record)}
                  variant="danger"
                />
              </View>
            </View>
          );
        })}
        {selectedDayComment !== null ? (
          <View style={styles.reviewItem}>
            <Text style={styles.rowTitle}>Day comment</Text>
            <Text style={styles.rowMeta}>{selectedDayComment.comment}</Text>
            <View style={styles.inlineButtons}>
              <ActionButton
                compact
                label="Edit"
                onPress={() => onEditComment(selectedDayComment)}
                variant="secondary"
              />
              <ActionButton
                compact
                label="Delete"
                onPress={() => onDeleteComment(selectedDayComment)}
                variant="danger"
              />
            </View>
          </View>
        ) : (
          <Text style={styles.mutedText}>No day comment for this date.</Text>
        )}
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={selectedChildId === null}
            label="Log Attendance"
            onPress={onOpenAttendance}
            variant="secondary"
          />
          <ActionButton
            compact
            disabled={selectedChildId === null}
            label={selectedDayComment === null ? "Add Note" : "Edit Note"}
            onPress={onOpenComments}
            variant="secondary"
          />
        </View>
      </SectionCard>
    </View>
  );
}
