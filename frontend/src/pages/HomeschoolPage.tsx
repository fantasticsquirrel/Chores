import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient, ApiClientError, type Child, type HomeschoolSemester, type HomeschoolSubject } from "../api";
import { useAuth } from "../auth/useAuth";
import { Button, ButtonLink, Card, DateInput, FormField, InlineNotice, TextInput } from "../ui";

type HomeschoolState = {
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
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
    loading: true,
    error: null,
  });
  const [semesterName, setSemesterName] = useState("");
  const [semesterStart, setSemesterStart] = useState(todayISO());
  const [semesterEnd, setSemesterEnd] = useState(todayISO());
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
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
      setState({ children: [], semesters: [], subjects: [], loading: false, error: "Could not determine household scope." });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listHomeschoolSemesters(householdId),
      apiClient.listHomeschoolSubjects(householdId),
    ])
      .then(([children, semesters, subjects]) => {
        setState({ children, semesters, subjects, loading: false, error: null });
        setAttendance((prev) => ({
          ...prev,
          childId: prev.childId || children[0]?.id.toString() || "",
          subjectId: prev.subjectId || subjects[0]?.id.toString() || "",
        }));
      })
      .catch((error: unknown) => {
        setState({ children: [], semesters: [], subjects: [], loading: false, error: formatLoadError(error) });
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
    } catch (error: unknown) {
      setActionError(formatLoadError(error));
    }
  }

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
