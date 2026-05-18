import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient } from "../api";
import { useAuth } from "../auth/useAuth";
import { ButtonLink, Card, InlineNotice } from "../ui";
import { todayISO, toYearMonth } from "./homeschool/dateUtils";
import { AttendanceCalendar } from "./homeschool/AttendanceCalendar";
import { HomeschoolSummary } from "./homeschool/HomeschoolSummary";
import { HomeschoolForms, type AttendanceFormState, type DayCommentFormState, type GradeFormState } from "./homeschool/HomeschoolForms";
import { HomeschoolStatus } from "./homeschool/HomeschoolStatus";
import { formatLoadError, useHomeschoolData } from "./homeschool/useHomeschoolData";

function confirmDestructiveAction(message: string): boolean {
  return window.confirm(message);
}

export function HomeschoolPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const { data: state, refresh } = useHomeschoolData(householdId);
  const [semesterName, setSemesterName] = useState("");
  const [semesterStart, setSemesterStart] = useState(todayISO());
  const [semesterEnd, setSemesterEnd] = useState(todayISO());
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [calendarYearMonth, setCalendarYearMonth] = useState(toYearMonth(todayISO()));
  const [calendarChildId, setCalendarChildId] = useState("");
  const [dayComment, setDayComment] = useState<DayCommentFormState>({
    childId: "",
    date: todayISO(),
    comment: "",
  });
  const [grade, setGrade] = useState<GradeFormState>({
    childId: "",
    subjectId: "",
    semesterId: "",
    grade: "",
  });
  const [attendance, setAttendance] = useState<AttendanceFormState>({
    childId: "",
    subjectId: "",
    date: todayISO(),
    present: true,
    comment: "",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setAttendance((prev) => ({
      ...prev,
      childId: prev.childId || state.children[0]?.id.toString() || "",
      subjectId: prev.subjectId || state.subjects[0]?.id.toString() || "",
    }));
    setCalendarChildId((prev) => prev || state.children[0]?.id.toString() || "");
    setDayComment((prev) => ({ ...prev, childId: prev.childId || state.children[0]?.id.toString() || "" }));
    setGrade((prev) => ({
      ...prev,
      childId: prev.childId || state.children[0]?.id.toString() || "",
      subjectId: prev.subjectId || state.subjects[0]?.id.toString() || "",
      semesterId: prev.semesterId || state.semesters[0]?.id.toString() || "",
    }));
  }, [state.children, state.semesters, state.subjects]);

  async function handleCreateSemester(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const created = await apiClient.createHomeschoolSemester({
        household_id: householdId,
        name: semesterName,
        start_date: semesterStart,
        end_date: semesterEnd,
      });
      setSemesterName("");
      setActionMessage(`Created semester ${created.name}.`);
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleDeleteSemester(semesterId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Delete this semester?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolSemester(semesterId, householdId);
      setActionMessage("Deleted semester.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const created = await apiClient.createHomeschoolSubject({
        household_id: householdId,
        name: subjectName,
        color: subjectColor,
      });
      setSubjectName("");
      setActionMessage(`Created subject ${created.name}.`);
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleDeleteSubject(subjectId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Delete this subject?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolSubject(subjectId, householdId);
      setActionMessage("Deleted subject.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleSaveAttendance(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null || attendance.childId === "" || attendance.subjectId === "") return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.upsertHomeschoolAttendance({
        household_id: householdId,
        child_id: Number(attendance.childId),
        subject_id: Number(attendance.subjectId),
        date: attendance.date,
        present: attendance.present,
        comment: attendance.comment,
      });
      setAttendance((prev) => ({ ...prev, comment: "" }));
      setActionMessage("Saved attendance.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleClearAttendance(attendanceId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Clear this attendance entry?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolAttendance(attendanceId, householdId);
      setActionMessage("Cleared attendance entry.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleClearDayComment(commentId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Clear this day comment?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolDayComment(commentId, householdId);
      setActionMessage("Cleared day comment.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleSaveDayComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null || dayComment.childId === "") return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.upsertHomeschoolDayComment({
        household_id: householdId,
        child_id: Number(dayComment.childId),
        date: dayComment.date,
        comment: dayComment.comment,
      });
      setActionMessage("Saved day comment.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleClearGrade(gradeId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Clear this grade?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolGrade(gradeId, householdId);
      setActionMessage("Cleared grade.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  async function handleSaveGrade(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null || grade.childId === "" || grade.subjectId === "") return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.upsertHomeschoolGrade({
        household_id: householdId,
        child_id: Number(grade.childId),
        subject_id: Number(grade.subjectId),
        semester_id: grade.semesterId === "" ? null : Number(grade.semesterId),
        grade: grade.grade,
      });
      setActionMessage("Saved grade.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

  const selectedChildAttendance = state.attendanceRecords.filter(
    (record) => calendarChildId !== "" && record.child_id === Number(calendarChildId),
  );
  const selectedChildComments = state.dayComments.filter(
    (comment) => calendarChildId !== "" && comment.child_id === Number(calendarChildId),
  );
  const selectedChildGrades = state.grades.filter(
    (record) => calendarChildId !== "" && record.child_id === Number(calendarChildId),
  );
  const selectedSemester = state.semesters.find((semester) => semester.id.toString() === grade.semesterId) ?? state.semesters[0] ?? null;

  return (
    <section className="dashboard-grid" aria-label="Homeschool module">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Family Manager Module</p>
            <h1>Homeschool</h1>
          </div>
        </div>
        <p>
          Homeschool now shares Family Manager children and accounts. This slice adds basic semester, subject, and
          attendance entry before the full calendar UI comes over.
        </p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Review Linked Children</ButtonLink>
          <ButtonLink to="/admin/dashboard">Module Access</ButtonLink>
        </div>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Linked Children</p>
        <p className="metric-value">{state.loading ? "-" : state.children.length}</p>
        <p className="metric-footnote">Shared with Chores.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Semesters</p>
        <p className="metric-value">{state.loading ? "-" : state.semesters.length}</p>
        <p className="metric-footnote">Backed by homeschool tables.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Subjects</p>
        <p className="metric-value">{state.loading ? "-" : state.subjects.length}</p>
        <p className="metric-footnote">Household-scoped subject palette.</p>
      </Card>

      {state.error !== null ? <InlineNotice variant="error">Could not load homeschool data: {state.error}</InlineNotice> : null}
      {actionError !== null ? <InlineNotice variant="error">Homeschool action failed: {actionError}</InlineNotice> : null}
      {actionMessage !== null ? <InlineNotice>{actionMessage}</InlineNotice> : null}

      <HomeschoolForms
        householdId={householdId}
        children={state.children}
        semesters={state.semesters}
        subjects={state.subjects}
        semesterName={semesterName}
        semesterStart={semesterStart}
        semesterEnd={semesterEnd}
        subjectName={subjectName}
        subjectColor={subjectColor}
        attendance={attendance}
        dayComment={dayComment}
        grade={grade}
        onSemesterNameChange={setSemesterName}
        onSemesterStartChange={setSemesterStart}
        onSemesterEndChange={setSemesterEnd}
        onSubjectNameChange={setSubjectName}
        onSubjectColorChange={setSubjectColor}
        onAttendanceChange={(patch) => setAttendance((prev) => ({ ...prev, ...patch }))}
        onDayCommentChange={(patch) => setDayComment((prev) => ({ ...prev, ...patch }))}
        onGradeChange={(patch) => setGrade((prev) => ({ ...prev, ...patch }))}
        onCreateSemester={(event) => void handleCreateSemester(event)}
        onCreateSubject={(event) => void handleCreateSubject(event)}
        onSaveAttendance={(event) => void handleSaveAttendance(event)}
        onSaveDayComment={(event) => void handleSaveDayComment(event)}
        onSaveGrade={(event) => void handleSaveGrade(event)}
      />

      <AttendanceCalendar
        calendarYearMonth={calendarYearMonth}
        calendarChildId={calendarChildId}
        children={state.children}
        selectedChildAttendance={selectedChildAttendance}
        selectedChildComments={selectedChildComments}
        subjects={state.subjects}
        onMonthChange={setCalendarYearMonth}
        onChildChange={setCalendarChildId}
        onDaySelect={(date, comment) => {
          setAttendance((prev) => ({ ...prev, childId: calendarChildId || prev.childId, date }));
          setDayComment((prev) => ({ ...prev, childId: calendarChildId || prev.childId, date, comment: comment || prev.comment }));
        }}
        onClearAttendance={(attendanceId) => void handleClearAttendance(attendanceId)}
        onClearDayComment={(commentId) => void handleClearDayComment(commentId)}
      />

      <HomeschoolSummary
        calendarChildId={calendarChildId}
        selectedSemester={selectedSemester}
        selectedChildAttendance={selectedChildAttendance}
        selectedChildComments={selectedChildComments}
        selectedChildGrades={selectedChildGrades}
        subjects={state.subjects}
      />

      <HomeschoolStatus
        loading={state.loading}
        children={state.children}
        semesters={state.semesters}
        subjects={state.subjects}
        dayComments={state.dayComments}
        selectedChildGrades={selectedChildGrades}
        onClearGrade={(gradeId) => void handleClearGrade(gradeId)}
        onDeleteSemester={(semesterId) => void handleDeleteSemester(semesterId)}
        onDeleteSubject={(subjectId) => void handleDeleteSubject(subjectId)}
      />
    </section>
  );
}
