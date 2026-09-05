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
import { homeschoolStyles } from "../../features/homeschool/styles";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
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
        <View style={shellStyles.compactStack}>
          {activeChildren.length === 0 ? (
            <Text style={shellStyles.mutedText}>No active children found.</Text>
          ) : (
            activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => onChildChange(child.id)}
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
            ))
          )}
        </View>

        <View style={homeschoolStyles.divider} />
        <View style={shellStyles.splitRow}>
          <Text style={cardStyles.cardTitle}>{formatYearMonth(calendarYearMonth)}</Text>
        </View>
        <View style={formStyles.inlineButtons}>
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

        <View style={homeschoolStyles.calendarWeekRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} style={homeschoolStyles.calendarWeekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={homeschoolStyles.calendarGrid}>
          {daySummaries.map((day) => {
            const selected = day.iso === selectedDate;
            return (
              <Pressable
                accessibilityRole="button"
                key={day.iso}
                onPress={() => onDateSelect(day.iso)}
                style={[
                  homeschoolStyles.calendarCell,
                  !day.inMonth ? homeschoolStyles.calendarCellMuted : null,
                  selected ? homeschoolStyles.calendarCellSelected : null,
                ]}
              >
                <Text
                  style={[
                    homeschoolStyles.calendarCellText,
                    !day.inMonth ? homeschoolStyles.calendarCellTextMuted : null,
                    selected ? homeschoolStyles.calendarCellTextSelected : null,
                  ]}
                >
                  {day.day}
                  {day.comment !== null ? "*" : ""}
                </Text>
                {day.presentCount > 0 ? (
                  <View style={homeschoolStyles.calendarSubjectRow}>
                    {day.subjectInitials.map((initial, index) => (
                      <Text
                        key={`${day.iso}-${initial}-${index}`}
                        style={[
                          homeschoolStyles.calendarSubjectInitial,
                          selected
                            ? homeschoolStyles.calendarSubjectInitialSelected
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
          <Text style={shellStyles.mutedText}>Select a child to review this day.</Text>
        ) : null}
        {selectedChildId !== null && selectedDayAttendance.length === 0 ? (
          <Text style={shellStyles.mutedText}>No attendance entries for this day.</Text>
        ) : null}
        {selectedDayAttendance.map((record) => {
          const subject = subjectLookup.get(record.subject_id);
          return (
            <View key={record.id} style={cardStyles.reviewItem}>
              <Text style={formStyles.rowTitle}>
                {subject?.name ?? `Subject ${record.subject_id}`}
              </Text>
              <Text style={formStyles.rowMeta}>
                {record.present ? "Present" : "Not present"}
                {record.comment.trim().length > 0
                  ? ` - ${record.comment}`
                  : ""}
              </Text>
              <View style={formStyles.inlineButtons}>
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
          <View style={cardStyles.reviewItem}>
            <Text style={formStyles.rowTitle}>Day comment</Text>
            <Text style={formStyles.rowMeta}>{selectedDayComment.comment}</Text>
            <View style={formStyles.inlineButtons}>
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
          <Text style={shellStyles.mutedText}>No day comment for this date.</Text>
        )}
        <View style={formStyles.inlineButtons}>
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
