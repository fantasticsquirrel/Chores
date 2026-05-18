import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient, ApiClientError, type Child, type HomeschoolAttendance, type HomeschoolDayComment, type HomeschoolGrade, type HomeschoolSemester, type HomeschoolSubject } from "../api";
import { useAuth } from "../auth/useAuth";
import { ButtonLink, Card, InlineNotice } from "../ui";
import { todayISO, toYearMonth } from "./homeschool/dateUtils";
import { AttendanceCalendar } from "./homeschool/AttendanceCalendar";
import { HomeschoolSummary } from "./homeschool/HomeschoolSummary";
import { HomeschoolForms, type AttendanceFormState, type DayCommentFormState, type GradeFormState } from "./homeschool/HomeschoolForms";

type HomeschoolState = {
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  attendanceRecords: HomeschoolAttendance[];
  dayComments: HomeschoolDayComment[];
  grades: HomeschoolGrade[];
  loading: boolean;
  error: string | null;
};

function formatLoadError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}

export function HomeschoolPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const [state, setState] = useState<HomeschoolState>({
    children: [],
    semesters: [],
    subjects: [],
    attendanceRecords: [],
    dayComments: [],
    grades: [],
    loading: true,
    error: null,
  });
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

  function refresh(): void {
    if (householdId === null) {
      setState({ children: [], semesters: [], subjects: [], attendanceRecords: [], dayComments: [], grades: [], loading: false, error: "Could not determine household scope." });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listHomeschoolSemesters(householdId),
      apiClient.listHomeschoolSubjects(householdId),
      apiClient.listHomeschoolAttendance(householdId),
      apiClient.listHomeschoolDayComments(householdId),
      apiClient.listHomeschoolGrades(householdId),
    ])
      .then(([children, semesters, subjects, attendanceRecords, dayComments, grades]) => {
        setState({ children, semesters, subjects, attendanceRecords, dayComments, grades, loading: false, error: null });
        setAttendance((prev) => ({
          ...prev,
          childId: prev.childId || children[0]?.id.toString() || "",
          subjectId: prev.subjectId || subjects[0]?.id.toString() || "",
        }));
        setCalendarChildId((prev) => prev || children[0]?.id.toString() || "");
        setDayComment((prev) => ({ ...prev, childId: prev.childId || children[0]?.id.toString() || "" }));
        setGrade((prev) => ({
          ...prev,
          childId: prev.childId || children[0]?.id.toString() || "",
          subjectId: prev.subjectId || subjects[0]?.id.toString() || "",
          semesterId: prev.semesterId || semesters[0]?.id.toString() || "",
        }));
      })
      .catch((error: unknown) => {
        setState({ children: [], semesters: [], subjects: [], attendanceRecords: [], dayComments: [], grades: [], loading: false, error: formatLoadError(error) });
      });
  }

  useEffect(() => {
    refresh();
    // refresh intentionally depends on householdId only; defining it inline keeps page state local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

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
  const subjectLookup = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const semesterLookup = new Map(state.semesters.map((semester) => [semester.id, semester]));
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
      />

      <HomeschoolSummary
        calendarChildId={calendarChildId}
        selectedSemester={selectedSemester}
        selectedChildAttendance={selectedChildAttendance}
        selectedChildComments={selectedChildComments}
        selectedChildGrades={selectedChildGrades}
        subjects={state.subjects}
      />

      <Card className="dashboard-panel">
        <h2>Current Setup</h2>
        {state.loading ? <p>Loading homeschool module data...</p> : null}
        {!state.loading && state.error === null ? (
          <ul className="balance-list">
            <li className="balance-item">Children: {state.children.map((child) => child.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Semesters: {state.semesters.map((semester) => semester.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Subjects: {state.subjects.map((subject) => subject.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Day comments: {state.dayComments.length}</li>
            <li className="balance-item">Grades: {state.grades.length}</li>
          </ul>
        ) : null}

        {!state.loading && selectedChildGrades.length > 0 ? (
          <ul className="balance-list">
            {selectedChildGrades.map((record) => (
              <li key={record.id} className="balance-item">
                <div>
                  <p className="balance-name">{subjectLookup.get(record.subject_id)?.name || `Subject ${record.subject_id}`}: {record.grade || "—"}</p>
                  <p className="balance-meta">{record.semester_id ? semesterLookup.get(record.semester_id)?.name || `Semester ${record.semester_id}` : "Overall"}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
