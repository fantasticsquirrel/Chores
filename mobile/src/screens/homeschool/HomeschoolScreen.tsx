import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type {
  AuthSessionResponse,
  Child,
  FamilyModule,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { hasModule } from "../../navigation/tabs";
import { styles } from "../../styles/layout";
import { todayDateString } from "../../utils/date";
import { formatError, isParentRole } from "../../utils/format";
import { HomeschoolCalendarScreen } from "./HomeschoolCalendarScreen";
import {
  type AttendanceFormState,
  type DayCommentFormState,
  type GradeFormState,
  HomeschoolAttendanceSection,
  HomeschoolCommentsSection,
  HomeschoolGradesSection,
  HomeschoolSetupSection,
  type SemesterFormState,
  type SubjectFormState,
} from "../../features/homeschool/components/HomeschoolForms";
import {
  type HomeschoolTab,
  buildSubjectSummaryRows,
  countUniquePresentDays,
  filterByChild,
  homeschoolTabOptions,
  normalizeSubjectColor,
  selectKnownId,
  toYearMonth,
  validateSemesterForm,
} from "../../features/homeschool/lib/homeschoolLogic";

type HomeschoolDataState = {
  attendance: HomeschoolAttendance[];
  children: Child[];
  comments: HomeschoolDayComment[];
  error: string | null;
  grades: HomeschoolGrade[];
  loading: boolean;
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
};

type BusyKey =
  | "attendance"
  | "comment"
  | "delete"
  | "grade"
  | "semester"
  | "subject"
  | null;

const emptyState: HomeschoolDataState = {
  attendance: [],
  children: [],
  comments: [],
  error: null,
  grades: [],
  loading: false,
  semesters: [],
  subjects: [],
};

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
  const [state, setState] = useState<HomeschoolDataState>(emptyState);
  const [activeSection, setActiveSection] =
    useState<HomeschoolTab>("overview");
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null,
  );
  const [calendarYearMonth, setCalendarYearMonth] = useState(() =>
    toYearMonth(todayDateString()),
  );
  const [selectedDate, setSelectedDate] = useState(todayDateString);
  const [semesterForm, setSemesterForm] = useState<SemesterFormState>(
    buildDefaultSemesterForm,
  );
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(
    buildDefaultSubjectForm,
  );
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>(
    buildDefaultAttendanceForm,
  );
  const [commentForm, setCommentForm] = useState<DayCommentFormState>(
    buildDefaultCommentForm,
  );
  const [gradeForm, setGradeForm] =
    useState<GradeFormState>(buildDefaultGradeForm);
  const [editingSemesterId, setEditingSemesterId] = useState<number | null>(
    null,
  );
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<BusyKey>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!homeschoolEnabled) {
      return;
    }
    setState((previous) => ({ ...previous, error: null, loading: true }));
    try {
      const [
        children,
        semesters,
        subjects,
        attendance,
        comments,
        grades,
      ] = await Promise.all([
        apiClient.listChildren({ active_only: true, household_id: householdId }),
        apiClient.listHomeschoolSemesters(householdId),
        apiClient.listHomeschoolSubjects(householdId),
        apiClient.listHomeschoolAttendance(householdId),
        apiClient.listHomeschoolDayComments(householdId),
        apiClient.listHomeschoolGrades(householdId),
      ]);
      setState({
        attendance,
        children,
        comments,
        error: null,
        grades,
        loading: false,
        semesters,
        subjects,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: formatError(error),
        loading: false,
      }));
    }
  }, [homeschoolEnabled, householdId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeChildren = useMemo(
    () => state.children.filter((child) => child.active),
    [state.children],
  );
  const semesterChoices = useMemo(() => {
    const activeSemesters = state.semesters.filter((semester) => semester.active);
    return activeSemesters.length > 0 ? activeSemesters : state.semesters;
  }, [state.semesters]);

  useEffect(() => {
    setSelectedChildId((current) => selectKnownId(current, activeChildren));
  }, [activeChildren]);

  useEffect(() => {
    setSelectedSemesterId((current) => selectKnownId(current, semesterChoices));
  }, [semesterChoices]);

  useEffect(() => {
    const defaultChildId =
      selectedChildId?.toString() ?? activeChildren[0]?.id.toString() ?? "";
    const defaultSubjectId = state.subjects[0]?.id.toString() ?? "";

    setAttendanceForm((previous) => ({
      ...previous,
      childId: knownStringId(previous.childId, activeChildren) ?? defaultChildId,
      subjectId: knownStringId(previous.subjectId, state.subjects) ?? defaultSubjectId,
    }));
    setCommentForm((previous) => ({
      ...previous,
      childId: knownStringId(previous.childId, activeChildren) ?? defaultChildId,
    }));
    setGradeForm((previous) => ({
      ...previous,
      childId: knownStringId(previous.childId, activeChildren) ?? defaultChildId,
      semesterId:
        previous.semesterId === "" ||
        state.semesters.some(
          (semester) => semester.id.toString() === previous.semesterId,
        )
          ? previous.semesterId
          : "",
      subjectId: knownStringId(previous.subjectId, state.subjects) ?? defaultSubjectId,
    }));
  }, [activeChildren, selectedChildId, state.semesters, state.subjects]);

  const selectedChild =
    selectedChildId === null
      ? null
      : (activeChildren.find((child) => child.id === selectedChildId) ?? null);
  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (state.semesters.find((semester) => semester.id === selectedSemesterId) ??
        null);
  const selectedChildAttendance = useMemo(
    () => filterByChild(state.attendance, selectedChildId),
    [selectedChildId, state.attendance],
  );
  const selectedChildComments = useMemo(
    () => filterByChild(state.comments, selectedChildId),
    [selectedChildId, state.comments],
  );
  const selectedChildGrades = useMemo(
    () => filterByChild(state.grades, selectedChildId),
    [selectedChildId, state.grades],
  );
  const summaryRows = useMemo(
    () =>
      buildSubjectSummaryRows({
        attendance: selectedChildAttendance,
        grades: selectedChildGrades,
        semester: selectedSemester,
        subjects: state.subjects,
      }),
    [selectedChildAttendance, selectedChildGrades, selectedSemester, state.subjects],
  );
  const commentsInSemester = selectedChildComments.filter(
    (comment) =>
      selectedSemester === null ||
      (comment.date >= selectedSemester.start_date &&
        comment.date <= selectedSemester.end_date),
  );
  const uniqueAttendanceDays = countUniquePresentDays(
    selectedChildAttendance,
    selectedSemester,
  );
  const busy = busyKey !== null;

  if (!homeschoolEnabled) {
    return (
      <View>
        <ScreenHeader subtitle="Module access" title="Homeschool" />
        <SectionCard title="Unavailable">
          <Text style={styles.mutedText}>
            Homeschool is not enabled for this account.
          </Text>
        </SectionCard>
      </View>
    );
  }

  async function runAction(
    key: BusyKey,
    successMessage: string,
    operation: () => Promise<void>,
    afterSuccess?: () => void,
  ) {
    setBusyKey(key);
    setActionError(null);
    setActionMessage(null);
    try {
      await operation();
      afterSuccess?.();
      setActionMessage(successMessage);
      await refresh();
    } catch (error) {
      setActionError(`Homeschool action failed: ${formatError(error)}`);
    } finally {
      setBusyKey(null);
    }
  }

  function updateSemesterForm(patch: Partial<SemesterFormState>) {
    setSemesterForm((previous) => ({ ...previous, ...patch }));
    setActionError(null);
    setActionMessage(null);
  }

  function updateSubjectForm(patch: Partial<SubjectFormState>) {
    setSubjectForm((previous) => ({ ...previous, ...patch }));
    setActionError(null);
    setActionMessage(null);
  }

  function clearSemesterEdit() {
    setEditingSemesterId(null);
    setSemesterForm(buildDefaultSemesterForm());
  }

  function clearSubjectEdit() {
    setEditingSubjectId(null);
    setSubjectForm(buildDefaultSubjectForm());
  }

  function editSemester(semester: HomeschoolSemester) {
    setActiveSection("setup");
    setEditingSemesterId(semester.id);
    setSemesterForm({
      active: semester.active,
      end_date: semester.end_date,
      name: semester.name,
      start_date: semester.start_date,
    });
    setActionError(null);
    setActionMessage(null);
  }

  function editSubject(subject: HomeschoolSubject) {
    setActiveSection("setup");
    setEditingSubjectId(subject.id);
    setSubjectForm({
      active: subject.active,
      color: subject.color,
      name: subject.name,
    });
    setActionError(null);
    setActionMessage(null);
  }

  async function saveSemester() {
    const validation = validateSemesterForm({
      endDate: semesterForm.end_date,
      name: semesterForm.name,
      startDate: semesterForm.start_date,
    });
    if (validation !== null) {
      setActionError(validation);
      setActionMessage(null);
      return;
    }

    const editingId = editingSemesterId;
    const trimmedName = semesterForm.name.trim();
    await runAction(
      "semester",
      editingId === null
        ? `Created semester ${trimmedName}.`
        : `Updated semester ${trimmedName}.`,
      async () => {
        const payload = {
          active: semesterForm.active,
          end_date: semesterForm.end_date,
          household_id: householdId,
          name: trimmedName,
          start_date: semesterForm.start_date,
        };
        if (editingId === null) {
          await apiClient.createHomeschoolSemester(payload);
        } else {
          await apiClient.updateHomeschoolSemester(editingId, payload);
        }
      },
      clearSemesterEdit,
    );
  }

  async function saveSubject() {
    const trimmedName = subjectForm.name.trim();
    if (trimmedName.length === 0) {
      setActionError("Subject name is required.");
      setActionMessage(null);
      return;
    }

    const editingId = editingSubjectId;
    const color = normalizeSubjectColor(subjectForm.color);
    await runAction(
      "subject",
      editingId === null
        ? `Created subject ${trimmedName}.`
        : `Updated subject ${trimmedName}.`,
      async () => {
        const payload = {
          active: subjectForm.active,
          color,
          household_id: householdId,
          name: trimmedName,
        };
        if (editingId === null) {
          await apiClient.createHomeschoolSubject(payload);
        } else {
          await apiClient.updateHomeschoolSubject(editingId, payload);
        }
      },
      clearSubjectEdit,
    );
  }

  function confirmDeleteSemester(semester: HomeschoolSemester) {
    Alert.alert(
      "Delete semester?",
      `"${semester.name}" will be removed only if no grades depend on it.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void deleteSemester(semester);
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  async function deleteSemester(semester: HomeschoolSemester) {
    await runAction(
      "delete",
      "Deleted semester.",
      async () => {
        await apiClient.deleteHomeschoolSemester(semester.id, householdId);
      },
      () => {
        if (editingSemesterId === semester.id) {
          clearSemesterEdit();
        }
      },
    );
  }

  function confirmDeleteSubject(subject: HomeschoolSubject) {
    Alert.alert(
      "Delete subject?",
      `"${subject.name}" will be removed only if no attendance or grades depend on it.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void deleteSubject(subject);
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  async function deleteSubject(subject: HomeschoolSubject) {
    await runAction(
      "delete",
      "Deleted subject.",
      async () => {
        await apiClient.deleteHomeschoolSubject(subject.id, householdId);
      },
      () => {
        if (editingSubjectId === subject.id) {
          clearSubjectEdit();
        }
      },
    );
  }

  async function saveAttendance() {
    if (attendanceForm.childId === "" || attendanceForm.subjectId === "") {
      setActionError("Choose a child and subject first.");
      setActionMessage(null);
      return;
    }

    await runAction(
      "attendance",
      "Saved attendance.",
      async () => {
        await apiClient.upsertHomeschoolAttendance({
          child_id: Number(attendanceForm.childId),
          comment: attendanceForm.comment,
          date: attendanceForm.date,
          household_id: householdId,
          present: attendanceForm.present,
          subject_id: Number(attendanceForm.subjectId),
        });
      },
      () => {
        setAttendanceForm((previous) => ({ ...previous, comment: "" }));
      },
    );
  }

  function editAttendance(record: HomeschoolAttendance) {
    setActiveSection("attendance");
    setSelectedChildId(record.child_id);
    setSelectedDate(record.date);
    setCalendarYearMonth(toYearMonth(record.date));
    setAttendanceForm({
      childId: record.child_id.toString(),
      comment: record.comment,
      date: record.date,
      present: record.present,
      subjectId: record.subject_id.toString(),
    });
    setActionError(null);
    setActionMessage(null);
  }

  function confirmDeleteAttendance(record: HomeschoolAttendance) {
    Alert.alert("Delete attendance?", "This attendance entry will be removed.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void deleteAttendance(record);
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteAttendance(record: HomeschoolAttendance) {
    await runAction("delete", "Deleted attendance.", async () => {
      await apiClient.deleteHomeschoolAttendance(record.id, householdId);
    });
  }

  async function saveComment() {
    if (commentForm.childId === "") {
      setActionError("Choose a child first.");
      setActionMessage(null);
      return;
    }

    await runAction("comment", "Saved day comment.", async () => {
      await apiClient.upsertHomeschoolDayComment({
        child_id: Number(commentForm.childId),
        comment: commentForm.comment,
        date: commentForm.date,
        household_id: householdId,
      });
    });
  }

  function editComment(comment: HomeschoolDayComment) {
    setActiveSection("comments");
    setSelectedChildId(comment.child_id);
    setSelectedDate(comment.date);
    setCalendarYearMonth(toYearMonth(comment.date));
    setCommentForm({
      childId: comment.child_id.toString(),
      comment: comment.comment,
      date: comment.date,
    });
    setActionError(null);
    setActionMessage(null);
  }

  function confirmDeleteComment(comment: HomeschoolDayComment) {
    Alert.alert("Delete day comment?", "This day comment will be removed.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void deleteComment(comment);
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteComment(comment: HomeschoolDayComment) {
    await runAction("delete", "Deleted day comment.", async () => {
      await apiClient.deleteHomeschoolDayComment(comment.id, householdId);
    });
  }

  async function saveGrade() {
    if (gradeForm.childId === "" || gradeForm.subjectId === "") {
      setActionError("Choose a child and subject first.");
      setActionMessage(null);
      return;
    }

    await runAction("grade", "Saved grade.", async () => {
      await apiClient.upsertHomeschoolGrade({
        child_id: Number(gradeForm.childId),
        grade: gradeForm.grade,
        household_id: householdId,
        semester_id:
          gradeForm.semesterId === "" ? null : Number(gradeForm.semesterId),
        subject_id: Number(gradeForm.subjectId),
      });
    });
  }

  function editGrade(grade: HomeschoolGrade) {
    setActiveSection("grades");
    setSelectedChildId(grade.child_id);
    setGradeForm({
      childId: grade.child_id.toString(),
      grade: grade.grade,
      semesterId: grade.semester_id?.toString() ?? "",
      subjectId: grade.subject_id.toString(),
    });
    setActionError(null);
    setActionMessage(null);
  }

  function confirmDeleteGrade(grade: HomeschoolGrade) {
    Alert.alert("Delete grade?", "This grade record will be removed.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void deleteGrade(grade);
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteGrade(grade: HomeschoolGrade) {
    await runAction("delete", "Deleted grade.", async () => {
      await apiClient.deleteHomeschoolGrade(grade.id, householdId);
    });
  }

  function openAttendanceForSelectedDay() {
    if (selectedChildId !== null) {
      setAttendanceForm((previous) => ({
        ...previous,
        childId: selectedChildId.toString(),
        date: selectedDate,
      }));
    }
    setActiveSection("attendance");
  }

  function openCommentForSelectedDay() {
    if (selectedChildId !== null) {
      const existingComment = selectedChildComments.find(
        (comment) => comment.date === selectedDate,
      );
      setCommentForm({
        childId: selectedChildId.toString(),
        comment: existingComment?.comment ?? "",
        date: selectedDate,
      });
    }
    setActiveSection("comments");
  }

  return (
    <View>
      <ScreenHeader
        subtitle="School setup and daily records"
        title="Homeschool"
        trailing={
          <ActionButton
            compact
            disabled={state.loading || busy}
            label={state.loading ? "Loading" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />

      {state.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load homeschool data: ${state.error}`}
        />
      ) : null}
      {actionError !== null ? (
        <InlineNotice tone="error" message={actionError} />
      ) : null}
      {actionMessage !== null ? (
        <InlineNotice tone="success" message={actionMessage} />
      ) : null}
      {state.loading ? <LoadingRow label="Loading homeschool data" /> : null}

      <SectionCard title="Workspace">
        <ChoiceGroup
          disabled={state.loading || busy}
          onChange={setActiveSection}
          options={homeschoolTabOptions}
          value={activeSection}
        />
      </SectionCard>

      {activeSection === "overview" ? (
        <OverviewSection
          activeChildren={activeChildren}
          commentsInSemester={commentsInSemester.length}
          grades={selectedChildGrades.length}
          selectedChild={selectedChild}
          selectedChildId={selectedChildId}
          selectedSemester={selectedSemester}
          selectedSemesterId={selectedSemesterId}
          semesters={semesterChoices}
          subjectRows={summaryRows}
          totalAttendanceEntries={
            selectedChildAttendance.filter((record) => record.present).length
          }
          uniqueAttendanceDays={uniqueAttendanceDays}
          onChildSelect={setSelectedChildId}
          onSemesterSelect={setSelectedSemesterId}
        />
      ) : null}

      {activeSection === "calendar" ? (
        <HomeschoolCalendarScreen
          activeChildren={activeChildren}
          calendarYearMonth={calendarYearMonth}
          selectedChildAttendance={selectedChildAttendance}
          selectedChildComments={selectedChildComments}
          selectedChildId={selectedChildId}
          selectedDate={selectedDate}
          subjects={state.subjects}
          onChildChange={setSelectedChildId}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setAttendanceForm((previous) => ({ ...previous, date }));
            setCommentForm((previous) => ({ ...previous, date }));
          }}
          onDeleteAttendance={confirmDeleteAttendance}
          onDeleteComment={confirmDeleteComment}
          onEditAttendance={editAttendance}
          onEditComment={editComment}
          onMonthChange={setCalendarYearMonth}
          onOpenAttendance={openAttendanceForSelectedDay}
          onOpenComments={openCommentForSelectedDay}
        />
      ) : null}

      {activeSection === "setup" ? (
        <HomeschoolSetupSection
          busy={busy}
          editingSemesterId={editingSemesterId}
          editingSubjectId={editingSubjectId}
          semesterForm={semesterForm}
          semesters={state.semesters}
          subjectForm={subjectForm}
          subjects={state.subjects}
          onCancelSemesterEdit={clearSemesterEdit}
          onCancelSubjectEdit={clearSubjectEdit}
          onDeleteSemester={confirmDeleteSemester}
          onDeleteSubject={confirmDeleteSubject}
          onEditSemester={editSemester}
          onEditSubject={editSubject}
          onSaveSemester={() => {
            void saveSemester();
          }}
          onSaveSubject={() => {
            void saveSubject();
          }}
          onSemesterChange={updateSemesterForm}
          onSubjectChange={updateSubjectForm}
        />
      ) : null}

      {activeSection === "attendance" ? (
        <HomeschoolAttendanceSection
          attendance={state.attendance}
          busy={busy}
          children={activeChildren}
          form={attendanceForm}
          subjects={state.subjects}
          onChange={(patch) =>
            setAttendanceForm((previous) => ({ ...previous, ...patch }))
          }
          onDelete={confirmDeleteAttendance}
          onEdit={editAttendance}
          onSave={() => {
            void saveAttendance();
          }}
        />
      ) : null}

      {activeSection === "comments" ? (
        <HomeschoolCommentsSection
          busy={busy}
          children={activeChildren}
          comments={state.comments}
          form={commentForm}
          onChange={(patch) =>
            setCommentForm((previous) => ({ ...previous, ...patch }))
          }
          onDelete={confirmDeleteComment}
          onEdit={editComment}
          onSave={() => {
            void saveComment();
          }}
        />
      ) : null}

      {activeSection === "grades" ? (
        <HomeschoolGradesSection
          busy={busy}
          children={activeChildren}
          form={gradeForm}
          grades={state.grades}
          semesters={state.semesters}
          subjects={state.subjects}
          onChange={(patch) =>
            setGradeForm((previous) => ({ ...previous, ...patch }))
          }
          onDelete={confirmDeleteGrade}
          onEdit={editGrade}
          onSave={() => {
            void saveGrade();
          }}
        />
      ) : null}
    </View>
  );
}

function OverviewSection({
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
  subjectRows: ReturnType<typeof buildSubjectSummaryRows>;
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
              selectedChildId === child.id ? styles.selectableRowSelected : null,
            ]}
          >
            <Text style={styles.rowTitle}>{child.name}</Text>
            <Text
              style={[
                styles.selectionMark,
                selectedChildId === child.id ? styles.selectionMarkSelected : null,
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
          <Text style={styles.mutedText}>Create subjects to see progress rows.</Text>
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

function buildDefaultSemesterForm(): SemesterFormState {
  const today = todayDateString();
  return {
    active: true,
    end_date: today,
    name: "",
    start_date: today,
  };
}

function buildDefaultSubjectForm(): SubjectFormState {
  return {
    active: true,
    color: "#3b82f6",
    name: "",
  };
}

function buildDefaultAttendanceForm(): AttendanceFormState {
  return {
    childId: "",
    comment: "",
    date: todayDateString(),
    present: true,
    subjectId: "",
  };
}

function buildDefaultCommentForm(): DayCommentFormState {
  return {
    childId: "",
    comment: "",
    date: todayDateString(),
  };
}

function buildDefaultGradeForm(): GradeFormState {
  return {
    childId: "",
    grade: "",
    semesterId: "",
    subjectId: "",
  };
}

function knownStringId<T extends { id: number }>(
  value: string,
  rows: T[],
): string | null {
  if (value !== "" && rows.some((row) => row.id.toString() === value)) {
    return value;
  }
  return null;
}
