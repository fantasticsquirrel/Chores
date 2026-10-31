import type { FormEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AttendanceDialog } from "../features/homeschool/components/AttendanceDialog";
import { isAttendanceDate, nextSubjectColor } from "../features/homeschool/lib/attendance";

import { apiClient, type HomeschoolSemester, type HomeschoolSubject } from "../api";
import { useAuth } from "../auth/useAuth";
import { ButtonLink, Card, InlineNotice } from "../ui";
import { todayISO, toYearMonth } from "./homeschool/dateUtils";
import { AttendanceCalendar } from "./homeschool/AttendanceCalendar";
import { HomeschoolSummary } from "./homeschool/HomeschoolSummary";
import { HomeschoolForms, type DayCommentFormState, type GradeFormState } from "./homeschool/HomeschoolForms";
import { HomeschoolStatus } from "./homeschool/HomeschoolStatus";
import { useHomeschoolData } from "./homeschool/useHomeschoolData";
import { formatApiError } from "../lib/errors";

function confirmDestructiveAction(message: string): boolean {
  return window.confirm(message);
}

export function HomeschoolPage(): ReactElement {
  const { user, manageableModuleKeys } = useAuth();
  const canManage = manageableModuleKeys.includes("homeschool");
  const householdId = user?.household_id ?? null;
  const { data: state, refresh, applyAttendanceRecord } = useHomeschoolData(householdId);
  const [semesterName, setSemesterName] = useState("");
  const [semesterStart, setSemesterStart] = useState(todayISO());
  const [semesterEnd, setSemesterEnd] = useState(todayISO());
  const [subjectName, setSubjectName] = useState("");
  const [subjectColorOverride, setSubjectColor] = useState<string | null>(null);
  const subjectColor = subjectColorOverride ?? nextSubjectColor(state.subjects);
  const [editingSemesterId, setEditingSemesterId] = useState<number | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [calendarYearMonth, setCalendarYearMonth] = useState(toYearMonth(todayISO()));
  const [reportSemesterId, setReportSemesterId] = useState("");
  const [calendarChildId, setCalendarChildId] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const requestedDate = searchParams.get("attendance");
  const selectedCalendarDate = isAttendanceDate(requestedDate) ? requestedDate : null;
  function setSelectedCalendarDate(date: string | null): void {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (date === null) next.delete("attendance");
      else next.set("attendance", date);
      return next;
    }, { replace: date === null });
  }
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
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const previousHousehold = useRef(householdId);
  const initializedForms = useRef<number | null>(null);
  useEffect(() => {
    if (previousHousehold.current !== null && previousHousehold.current !== householdId) {
      initializedForms.current = null;
      setCalendarChildId(""); setReportSemesterId("");
      setSubjectName(""); setSubjectColor(null); setEditingSubjectId(null);
      setSemesterName(""); setSemesterStart(todayISO()); setSemesterEnd(todayISO()); setEditingSemesterId(null);
      setDayComment({ childId: "", date: todayISO(), comment: "" });
      setGrade({ childId: "", subjectId: "", semesterId: "", grade: "" });
      setActionError(null); setActionMessage(null);
      setCalendarYearMonth(toYearMonth(todayISO()));
      setSearchParams((previous) => { const next = new URLSearchParams(previous); next.delete("attendance"); return next; }, { replace: true });
    }
    previousHousehold.current = householdId;
  }, [householdId, setSearchParams]);

  useEffect(() => {
    if (state.loading || state.error || householdId === null) return;
    const initial = initializedForms.current !== householdId;
    initializedForms.current = householdId;
    const reconcile = (value: string, rows: { id: number }[], allowEmpty = false) => {
      if (value === "" && (allowEmpty || !initial)) return "";
      return rows.some((row) => row.id.toString() === value) ? value : rows[0]?.id.toString() ?? "";
    };
    setCalendarChildId((prev) => reconcile(prev, state.children));
    setReportSemesterId((prev) => reconcile(prev, state.semesters));
    setDayComment((prev) => ({ ...prev, childId: reconcile(prev.childId, state.children) }));
    setGrade((prev) => ({ ...prev, childId: reconcile(prev.childId, state.children), subjectId: reconcile(prev.subjectId, state.subjects), semesterId: reconcile(prev.semesterId, state.semesters, !initial) }));
    if (editingSubjectId !== null && !state.subjects.some((subject) => subject.id === editingSubjectId)) {
      setEditingSubjectId(null); setSubjectName(""); setSubjectColor(null);
    }
    if (editingSemesterId !== null && !state.semesters.some((semester) => semester.id === editingSemesterId)) {
      setEditingSemesterId(null); setSemesterName(""); setSemesterStart(todayISO()); setSemesterEnd(todayISO());
    }
  }, [householdId, state.loading, state.error, state.children, state.semesters, state.subjects, editingSubjectId, editingSemesterId]);

  const initializedCalendar = useRef("");
  useEffect(() => {
    if (state.loading || state.error) return;
    const context = `${householdId}:${calendarChildId}`;
    if (initializedCalendar.current === context) return;
    initializedCalendar.current = context;
    const selectedChild = calendarChildId || state.children[0]?.id.toString() || "";
    const childAttendance = state.attendanceRecords
      .filter((record) => selectedChild !== "" && record.child_id === Number(selectedChild))
      .sort((a, b) => b.date.localeCompare(a.date));
    const preferredDate = childAttendance[0]?.date ?? state.semesters[0]?.start_date;
    if (preferredDate !== undefined) {
      setCalendarYearMonth(toYearMonth(preferredDate));
    }
  }, [householdId, calendarChildId, state.attendanceRecords, state.children, state.semesters, state.loading, state.error]);

  async function handleSaveSemester(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const payload = {
        household_id: householdId,
        name: semesterName,
        start_date: semesterStart,
        end_date: semesterEnd,
      };
      const saved = editingSemesterId === null
        ? await apiClient.createHomeschoolSemester(payload)
        : await apiClient.updateHomeschoolSemester(editingSemesterId, payload);
      clearSemesterEdit();
      setActionMessage(`${editingSemesterId === null ? "Created" : "Updated"} semester ${saved.name}.`);
      refresh();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    }
  }

  function startSemesterEdit(semester: HomeschoolSemester): void {
    setEditingSemesterId(semester.id);
    setSemesterName(semester.name);
    setSemesterStart(semester.start_date);
    setSemesterEnd(semester.end_date);
  }

  function clearSemesterEdit(): void {
    setEditingSemesterId(null);
    setSemesterName("");
    setSemesterStart(todayISO());
    setSemesterEnd(todayISO());
  }

  async function handleDeleteSemester(semesterId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Delete this semester?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolSemester(semesterId, householdId);
      if (editingSemesterId === semesterId) clearSemesterEdit();
      setActionMessage("Deleted semester.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    }
  }

  async function handleSaveSubject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (householdId === null) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const payload = {
        household_id: householdId,
        name: subjectName,
        color: subjectColor,
      };
      const saved = editingSubjectId === null
        ? await apiClient.createHomeschoolSubject(payload)
        : await apiClient.updateHomeschoolSubject(editingSubjectId, payload);
      clearSubjectEdit();
      setActionMessage(`${editingSubjectId === null ? "Created" : "Updated"} subject ${saved.name}.`);
      refresh();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
    }
  }

  function startSubjectEdit(subject: HomeschoolSubject): void {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectColor(subject.color);
  }

  function clearSubjectEdit(): void {
    setEditingSubjectId(null);
    setSubjectName("");
    setSubjectColor(null);
  }

  async function handleDeleteSubject(subjectId: number): Promise<void> {
    if (householdId === null || !confirmDestructiveAction("Delete this subject?")) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.deleteHomeschoolSubject(subjectId, householdId);
      if (editingSubjectId === subjectId) clearSubjectEdit();
      setActionMessage("Deleted subject.");
      refresh();
    } catch (error: unknown) {
      setActionError(formatApiError(error));
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
      setActionError(formatApiError(error));
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
      setActionError(formatApiError(error));
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
      setActionError(formatApiError(error));
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
      setActionError(formatApiError(error));
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
      setActionError(formatApiError(error));
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
  const selectedSemester = state.semesters.find((semester) => semester.id.toString() === reportSemesterId) ?? state.semesters[0] ?? null;

  return (
    <section className="dashboard-grid" aria-label="Homeschool module">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <h1>Homeschool</h1>
          </div>
        </div>
      </Card>

      <AttendanceCalendar
        canManage={canManage}
        saving={attendanceSaving}
        calendarYearMonth={calendarYearMonth}
        calendarChildId={calendarChildId}
        children={state.children}
        selectedChildAttendance={selectedChildAttendance}
        selectedChildComments={selectedChildComments}
        subjects={state.subjects}
        selectedDate={selectedCalendarDate}
        onMonthChange={(yearMonth) => {
          setCalendarYearMonth(yearMonth);
          setSelectedCalendarDate(null);
        }}
        onChildChange={(childId) => {
          setCalendarChildId(childId);
          setSelectedCalendarDate(null);
        }}
        onDaySelect={(date, comment) => {
          if (!canManage) return;
          setSelectedCalendarDate(date);
          setDayComment((prev) => ({ ...prev, childId: calendarChildId || prev.childId, date, comment }));
        }}
        onClearAttendance={(attendanceId) => void handleClearAttendance(attendanceId)}
        onClearDayComment={(commentId) => void handleClearDayComment(commentId)}
      />

      {attendanceSaving && selectedCalendarDate === null ? <p role="status">Saving attendance. Please wait before opening another day.</p> : null}
      {state.error !== null ? <InlineNotice variant="error">Could not load homeschool data: {state.error}</InlineNotice> : null}
      {actionError !== null ? <InlineNotice variant="error">Homeschool action failed: {actionError}</InlineNotice> : null}
      {actionMessage !== null ? <InlineNotice>{actionMessage}</InlineNotice> : null}
      {canManage && selectedCalendarDate !== null && householdId !== null && state.children.some((child) => child.id === Number(calendarChildId)) ? (
        <AttendanceDialog
          key={`${householdId}:${calendarChildId}:${selectedCalendarDate}:${location.key}`}
          householdId={householdId}
          childId={Number(calendarChildId)}
          childName={state.children.find((child) => child.id === Number(calendarChildId))?.name ?? "Child"}
          date={selectedCalendarDate}
          subjects={state.subjects}
          records={state.attendanceRecords}
          onClose={() => setSelectedCalendarDate(null)}
          onSaved={refresh}
          onRecordSaved={applyAttendanceRecord}
          onSavingChange={setAttendanceSaving}
          externallySaving={attendanceSaving}
        />
      ) : null}

      <HomeschoolSummary
        householdId={householdId}
        semesters={state.semesters}
        onSemesterChange={setReportSemesterId}
        calendarChildId={calendarChildId}
        selectedSemester={selectedSemester}
        selectedChildAttendance={selectedChildAttendance}
        selectedChildComments={selectedChildComments}
        selectedChildGrades={selectedChildGrades}
        subjects={state.subjects}
      />

      <div className="dashboard-section-header">
        <h2>Setup & Records</h2>
        <div className="quick-actions">
          <ButtonLink variant="secondary" to="/parent/children">Review Linked Children</ButtonLink>
          <ButtonLink variant="secondary" to="/admin/dashboard">Module Access</ButtonLink>
        </div>
      </div>

      <HomeschoolStatus
        loading={state.loading}
        children={state.children}
        semesters={state.semesters}
        subjects={state.subjects}
        dayComments={state.dayComments}
        selectedChildGrades={selectedChildGrades}
        onClearGrade={(gradeId) => void handleClearGrade(gradeId)}
        onEditSemester={startSemesterEdit}
        onDeleteSemester={(semesterId) => void handleDeleteSemester(semesterId)}
        onEditSubject={startSubjectEdit}
        onDeleteSubject={(subjectId) => void handleDeleteSubject(subjectId)}
      />

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
        editingSemesterId={editingSemesterId}
        editingSubjectId={editingSubjectId}
        dayComment={dayComment}
        grade={grade}
        onSemesterNameChange={setSemesterName}
        onSemesterStartChange={setSemesterStart}
        onSemesterEndChange={setSemesterEnd}
        onSubjectNameChange={setSubjectName}
        onSubjectColorChange={setSubjectColor}
        onDayCommentChange={(patch) => setDayComment((prev) => ({ ...prev, ...patch }))}
        onGradeChange={(patch) => setGrade((prev) => ({ ...prev, ...patch }))}
        onCancelSemesterEdit={clearSemesterEdit}
        onCancelSubjectEdit={clearSubjectEdit}
        onCreateSemester={(event) => void handleSaveSemester(event)}
        onCreateSubject={(event) => void handleSaveSubject(event)}
        onSaveDayComment={(event) => void handleSaveDayComment(event)}
        onSaveGrade={(event) => void handleSaveGrade(event)}
      />
    </section>
  );
}
