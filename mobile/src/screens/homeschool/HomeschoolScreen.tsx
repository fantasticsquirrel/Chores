import { useState } from "react";
import { Text, View } from "react-native";

import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { AttendanceDayModal } from "../../features/homeschool/components/AttendanceDayModal";
import { HomeschoolAttendanceSection } from "../../features/homeschool/components/HomeschoolAttendanceSection";
import { HomeschoolCommentSection } from "../../features/homeschool/components/HomeschoolCommentSection";
import { HomeschoolGradeSection } from "../../features/homeschool/components/HomeschoolGradeSection";
import { HomeschoolOverview } from "../../features/homeschool/components/HomeschoolOverview";
import {
  HomeschoolSemesterFormSection,
  HomeschoolSemesterListSection,
} from "../../features/homeschool/components/HomeschoolSemesterSection";
import {
  HomeschoolSubjectFormSection,
  HomeschoolSubjectListSection,
} from "../../features/homeschool/components/HomeschoolSubjectSection";
import { useHomeschoolData } from "../../features/homeschool/hooks/useHomeschoolData";
import { useHomeschoolMutations } from "../../features/homeschool/hooks/useHomeschoolMutations";
import {
  type HomeschoolTab,
  homeschoolTabOptions,
} from "../../features/homeschool/lib/options";
import { hasModule } from "../../navigation/tabs";
import { shellStyles } from "../../styles/shell";
import { isParentRole } from "../../utils/format";
import { HomeschoolCalendarScreen } from "./HomeschoolCalendarScreen";

export function HomeschoolScreen({
  modules,
  session,
}: {
  modules: FamilyModule[];
  session: AuthSessionResponse;
}) {
  const householdId = session.user.household_id;
  const homeschoolEnabled =
    isParentRole(session.user.role) && hasModule(modules, "homeschool");
  const [activeSection, setActiveSection] = useState<HomeschoolTab>("calendar");
  const [attendanceDay, setAttendanceDay] = useState<{
    childId: number;
    date: string;
  } | null>(null);
  const data = useHomeschoolData({ enabled: homeschoolEnabled, householdId });
  const mutations = useHomeschoolMutations({
    activeChildren: data.activeChildren,
    householdId,
    refresh: data.refresh,
    selectedChildComments: data.selectedChildComments,
    selectedChildId: data.selectedChildId,
    selectedDate: data.selectedDate,
    semesters: data.state.semesters,
    subjects: data.state.subjects,
    setCalendarYearMonth: data.setCalendarYearMonth,
    setSelectedChildId: data.setSelectedChildId,
    setSelectedDate: data.setSelectedDate,
  });

  if (!homeschoolEnabled) {
    return (
      <View>
        <ScreenHeader subtitle="Module access" title="Homeschool" />
        <SectionCard title="Unavailable">
          <Text style={shellStyles.mutedText}>
            Homeschool is not enabled for this account.
          </Text>
        </SectionCard>
      </View>
    );
  }

  return (
    <View>
      <ScreenHeader
        subtitle="School setup and daily records"
        title="Homeschool"
        trailing={
          <ActionButton
            compact
            disabled={data.state.loading || mutations.busy}
            label={data.state.loading ? "Loading" : "Refresh"}
            onPress={data.refresh}
            variant="secondary"
          />
        }
      />

      {data.state.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load homeschool data: ${data.state.error}`}
        />
      ) : null}
      {mutations.actionError !== null ? (
        <InlineNotice tone="error" message={mutations.actionError} />
      ) : null}
      {mutations.actionMessage !== null ? (
        <InlineNotice tone="success" message={mutations.actionMessage} />
      ) : null}
      {data.state.loading ? (
        <LoadingRow label="Loading homeschool data" />
      ) : null}

      {activeSection === "calendar" ? (
        <HomeschoolCalendarScreen
          activeChildren={data.activeChildren}
          calendarYearMonth={data.calendarYearMonth}
          selectedChildAttendance={data.selectedChildAttendance}
          selectedChildComments={data.selectedChildComments}
          selectedChildId={data.selectedChildId}
          selectedDate={data.selectedDate}
          subjects={data.state.subjects}
          onChildChange={data.setSelectedChildId}
          onDateSelect={(date) => {
            data.setSelectedDate(date);
            mutations.updateAttendanceForm({ date });
            mutations.updateCommentForm({ date });
            if (data.selectedChildId !== null)
              setAttendanceDay({ childId: data.selectedChildId, date });
          }}
          onDeleteAttendance={mutations.confirmDeleteAttendance}
          onDeleteComment={mutations.confirmDeleteComment}
          onEditAttendance={(record) => {
            setAttendanceDay({ childId: record.child_id, date: record.date });
          }}
          onEditComment={(comment) => {
            mutations.editComment(comment);
            setActiveSection("comments");
          }}
          onMonthChange={data.setCalendarYearMonth}
          onOpenAttendance={() => {
            if (data.selectedChildId !== null)
              setAttendanceDay({
                childId: data.selectedChildId,
                date: data.selectedDate,
              });
          }}
          onOpenComments={() => {
            mutations.openCommentForSelectedDay();
            setActiveSection("comments");
          }}
        />
      ) : null}

      <SectionCard title="Workspace">
        <ChoiceGroup
          disabled={data.state.loading || mutations.busy}
          onChange={setActiveSection}
          options={homeschoolTabOptions}
          value={activeSection}
        />
      </SectionCard>

      {activeSection === "overview" ? (
        <HomeschoolOverview
          householdId={householdId}
          activeChildren={data.activeChildren}
          commentsInSemester={data.commentsInSemester.length}
          grades={data.selectedChildGrades.length}
          selectedChild={data.selectedChild}
          selectedChildId={data.selectedChildId}
          selectedSemester={data.selectedSemester}
          selectedSemesterId={data.selectedSemesterId}
          semesters={data.semesterChoices}
          subjectRows={data.subjectRows}
          totalAttendanceEntries={data.totalAttendanceEntries}
          uniqueAttendanceDays={data.uniqueAttendanceDays}
          onChildSelect={data.setSelectedChildId}
          onSemesterSelect={data.setSelectedSemesterId}
        />
      ) : null}

      {activeSection === "setup" ? (
        <View>
          <HomeschoolSemesterFormSection
            busy={mutations.busy}
            editingSemesterId={mutations.editingSemesterId}
            form={mutations.semesterForm}
            onCancelEdit={mutations.clearSemesterEdit}
            onChange={mutations.updateSemesterForm}
            onSave={() => {
              void mutations.saveSemester();
            }}
          />
          <HomeschoolSubjectFormSection
            busy={mutations.busy}
            editingSubjectId={mutations.editingSubjectId}
            form={mutations.subjectForm}
            onCancelEdit={mutations.clearSubjectEdit}
            onChange={mutations.updateSubjectForm}
            onSave={() => {
              void mutations.saveSubject();
            }}
          />
          <HomeschoolSemesterListSection
            busy={mutations.busy}
            semesters={data.state.semesters}
            onDelete={mutations.confirmDeleteSemester}
            onEdit={mutations.editSemester}
          />
          <HomeschoolSubjectListSection
            busy={mutations.busy}
            subjects={data.state.subjects}
            onDelete={mutations.confirmDeleteSubject}
            onEdit={mutations.editSubject}
          />
        </View>
      ) : null}

      {activeSection === "attendance" ? (
        <HomeschoolAttendanceSection
          attendance={data.state.attendance}
          busy={mutations.busy}
          children={data.activeChildren}
          form={mutations.attendanceForm}
          subjects={data.state.subjects}
          onChange={mutations.updateAttendanceForm}
          onDelete={mutations.confirmDeleteAttendance}
          onEdit={(record) => {
            setAttendanceDay({ childId: record.child_id, date: record.date });
          }}
          onSave={() => {
            void mutations.saveAttendance();
          }}
        />
      ) : null}

      {activeSection === "comments" ? (
        <HomeschoolCommentSection
          busy={mutations.busy}
          children={data.activeChildren}
          comments={data.state.comments}
          form={mutations.commentForm}
          onChange={mutations.updateCommentForm}
          onDelete={mutations.confirmDeleteComment}
          onEdit={(comment) => {
            mutations.editComment(comment);
            setActiveSection("comments");
          }}
          onSave={() => {
            void mutations.saveComment();
          }}
        />
      ) : null}

      {activeSection === "grades" ? (
        <HomeschoolGradeSection
          busy={mutations.busy}
          children={data.activeChildren}
          form={mutations.gradeForm}
          grades={data.state.grades}
          semesters={data.state.semesters}
          subjects={data.state.subjects}
          onChange={mutations.updateGradeForm}
          onDelete={mutations.confirmDeleteGrade}
          onEdit={(grade) => {
            mutations.editGrade(grade);
            setActiveSection("grades");
          }}
          onSave={() => {
            void mutations.saveGrade();
          }}
        />
      ) : null}
      {attendanceDay !== null &&
      data.activeChildren.some(
        (child) =>
          child.id === attendanceDay.childId &&
          child.household_id === householdId,
      ) ? (
        <AttendanceDayModal
          key={`${householdId}:${attendanceDay.childId}:${attendanceDay.date}`}
          householdId={householdId}
          childId={attendanceDay.childId}
          childName={
            data.activeChildren.find(
              (child) => child.id === attendanceDay.childId,
            )?.name ?? "Child"
          }
          date={attendanceDay.date}
          subjects={data.state.subjects.filter(
            (subject) => subject.household_id === householdId,
          )}
          records={data.state.attendance}
          onClose={() => setAttendanceDay(null)}
          onRefresh={data.refresh}
          onRecordSaved={data.applyAttendanceRecord}
        />
      ) : null}
    </View>
  );
}
