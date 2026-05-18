import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient, ApiClientError, type Child, type HomeschoolAttendance, type HomeschoolSemester, type HomeschoolSubject } from "../api";
import { useAuth } from "../auth/useAuth";
import { Button, ButtonLink, Card, DateInput, FormField, InlineNotice, TextInput } from "../ui";

type HomeschoolState = {
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  attendanceRecords: HomeschoolAttendance[];
  loading: boolean;
  error: string | null;
};

type AttendanceFormState = {
  childId: string;
  subjectId: string;
  date: string;
  present: boolean;
  comment: string;
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeschoolPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const [state, setState] = useState<HomeschoolState>({
    children: [],
    semesters: [],
    subjects: [],
    attendanceRecords: [],
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
      setState({ children: [], semesters: [], subjects: [], attendanceRecords: [], loading: false, error: "Could not determine household scope." });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listHomeschoolSemesters(householdId),
      apiClient.listHomeschoolSubjects(householdId),
      apiClient.listHomeschoolAttendance(householdId),
    ])
      .then(([children, semesters, subjects, attendanceRecords]) => {
        setState({ children, semesters, subjects, attendanceRecords, loading: false, error: null });
        setAttendance((prev) => ({
          ...prev,
          childId: prev.childId || children[0]?.id.toString() || "",
          subjectId: prev.subjectId || subjects[0]?.id.toString() || "",
        }));
        setCalendarChildId((prev) => prev || children[0]?.id.toString() || "");
      })
      .catch((error: unknown) => {
        setState({ children: [], semesters: [], subjects: [], attendanceRecords: [], loading: false, error: formatLoadError(error) });
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


  const selectedChildAttendance = state.attendanceRecords.filter(
    (record) => calendarChildId !== "" && record.child_id === Number(calendarChildId),
  );
  const subjectLookup = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const monthCells = buildMonthGrid(calendarYearMonth);
  const calendarLabel = formatYearMonth(calendarYearMonth);

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

      <Card className="dashboard-panel">
        <h2>Create Semester</h2>
        <form className="children-form" onSubmit={(event) => void handleCreateSemester(event)}>
          <FormField label="Semester Name">
            <TextInput value={semesterName} onChange={(event) => setSemesterName(event.target.value)} placeholder="Fall 2026" required maxLength={255} />
          </FormField>
          <FormField label="Start Date">
            <DateInput value={semesterStart} onChange={(event) => setSemesterStart(event.target.value)} required />
          </FormField>
          <FormField label="End Date">
            <DateInput value={semesterEnd} onChange={(event) => setSemesterEnd(event.target.value)} required />
          </FormField>
          <Button type="submit" disabled={householdId === null || semesterName.trim().length === 0}>Create Semester</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Create Subject</h2>
        <form className="children-form" onSubmit={(event) => void handleCreateSubject(event)}>
          <FormField label="Subject Name">
            <TextInput value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Math" required maxLength={255} />
          </FormField>
          <FormField label="Color">
            <TextInput value={subjectColor} onChange={(event) => setSubjectColor(event.target.value)} placeholder="#3b82f6" required maxLength={32} />
          </FormField>
          <Button type="submit" disabled={householdId === null || subjectName.trim().length === 0}>Create Subject</Button>
        </form>
      </Card>



      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <h2>Attendance Calendar</h2>
          <div className="quick-actions">
            <Button type="button" onClick={() => setCalendarYearMonth(shiftYearMonth(calendarYearMonth, -1))}>Previous</Button>
            <Button type="button" onClick={() => setCalendarYearMonth(toYearMonth(todayISO()))}>Today</Button>
            <Button type="button" onClick={() => setCalendarYearMonth(shiftYearMonth(calendarYearMonth, 1))}>Next</Button>
          </div>
        </div>
        <FormField label="Child">
          <select className="text-input" value={calendarChildId} onChange={(event) => setCalendarChildId(event.target.value)}>
            <option value="">Select child</option>
            {state.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
        </FormField>
        <h3>{calendarLabel}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="eyebrow" style={{ textAlign: "center" }}>{day}</div>
          ))}
          {monthCells.map((cell) => {
            const records = selectedChildAttendance.filter((record) => record.date === cell.iso && record.present);
            return (
              <button
                key={cell.iso}
                type="button"
                className="glass-card button-reset"
                style={{
                  minHeight: 84,
                  padding: 8,
                  opacity: cell.inMonth ? 1 : 0.35,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: "flex-start",
                }}
                onClick={() => setAttendance((prev) => ({ ...prev, childId: calendarChildId || prev.childId, date: cell.iso }))}
              >
                <strong>{cell.day}</strong>
                {records.slice(0, 3).map((record) => {
                  const subject = subjectLookup.get(record.subject_id);
                  return (
                    <span key={record.id} className="balance-pill" style={{ background: subject?.color || undefined }}>
                      {subject?.name || `Subject ${record.subject_id}`}
                    </span>
                  );
                })}
                {records.length > 3 ? <span className="eyebrow">+{records.length - 3} more</span> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="dashboard-panel">
        <h2>Quick Attendance</h2>
        <form className="children-form" onSubmit={(event) => void handleSaveAttendance(event)}>
          <FormField label="Child">
            <select className="text-input" value={attendance.childId} onChange={(event) => setAttendance((prev) => ({ ...prev, childId: event.target.value }))} required>
              <option value="">Select child</option>
              {state.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject">
            <select className="text-input" value={attendance.subjectId} onChange={(event) => setAttendance((prev) => ({ ...prev, subjectId: event.target.value }))} required>
              <option value="">Select subject</option>
              {state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </FormField>
          <FormField label="Date">
            <DateInput value={attendance.date} onChange={(event) => setAttendance((prev) => ({ ...prev, date: event.target.value }))} required />
          </FormField>
          <label className="checkbox-row">
            <input type="checkbox" checked={attendance.present} onChange={(event) => setAttendance((prev) => ({ ...prev, present: event.target.checked }))} />
            Present
          </label>
          <FormField label="Comment">
            <TextInput value={attendance.comment} onChange={(event) => setAttendance((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Fractions, copywork, field trip..." maxLength={2000} />
          </FormField>
          <Button type="submit" disabled={attendance.childId === "" || attendance.subjectId === ""}>Save Attendance</Button>
        </form>
      </Card>

      <Card className="dashboard-panel">
        <h2>Current Setup</h2>
        {state.loading ? <p>Loading homeschool module data...</p> : null}
        {!state.loading && state.error === null ? (
          <ul className="balance-list">
            <li className="balance-item">Children: {state.children.map((child) => child.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Semesters: {state.semesters.map((semester) => semester.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Subjects: {state.subjects.map((subject) => subject.name).join(", ") || "none yet"}</li>
          </ul>
        ) : null}
      </Card>
    </section>
  );
}


type MonthCell = { iso: string; day: number; inMonth: boolean };

function toYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function isoFromParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function buildMonthGrid(yearMonth: string): MonthCell[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: MonthCell[] = [];

  for (let index = startDay - 1; index >= 0; index -= 1) {
    const day = prevDays - index;
    cells.push({ iso: isoFromParts(year, month - 1, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: isoFromParts(year, month, day), day, inMonth: true });
  }

  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ iso: isoFromParts(year, month + 1, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }

  return cells;
}
