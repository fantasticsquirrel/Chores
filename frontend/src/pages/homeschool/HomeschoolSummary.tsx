import type { ReactElement } from "react";

import type { HomeschoolAttendance, HomeschoolDayComment, HomeschoolGrade, HomeschoolSemester, HomeschoolSubject } from "../../api";
import { SemesterReportExport } from "../../features/homeschool/components/SemesterReportExport";
import { Card, FormField, Select } from "../../ui";

type HomeschoolSummaryProps = {
  householdId: number | null;
  semesters: HomeschoolSemester[];
  onSemesterChange: (semesterId: string) => void;
  calendarChildId: string;
  selectedSemester: HomeschoolSemester | null;
  selectedChildAttendance: HomeschoolAttendance[];
  selectedChildComments: HomeschoolDayComment[];
  selectedChildGrades: HomeschoolGrade[];
  subjects: HomeschoolSubject[];
};

export function HomeschoolSummary({
  householdId,
  semesters,
  onSemesterChange,
  calendarChildId,
  selectedSemester,
  selectedChildAttendance,
  selectedChildComments,
  selectedChildGrades,
  subjects,
}: HomeschoolSummaryProps): ReactElement {
  const reportRecords = selectedChildAttendance.filter(
    (record) => selectedSemester === null || (record.date >= selectedSemester.start_date && record.date <= selectedSemester.end_date),
  );
  const reportComments = selectedChildComments.filter(
    (comment) => selectedSemester === null || (comment.date >= selectedSemester.start_date && comment.date <= selectedSemester.end_date),
  );
  const reportSubjectRows = subjects.map((subject) => ({
    subject,
    days: reportRecords.filter((record) => record.subject_id === subject.id && record.present).length,
    grade: selectedChildGrades.find(
      (record) => record.subject_id === subject.id && record.semester_id === (selectedSemester?.id ?? null),
    )?.grade || "—",
  }));
  const reportUniqueDays = new Set(reportRecords.filter((record) => record.present).map((record) => record.date)).size;

  return (
    <Card className="dashboard-panel homeschool-report">
      <div className="panel-header-row">
        <div>
          <h2>Semester Summary</h2>
          <p className="balance-meta">
            {selectedSemester !== null
              ? `${selectedSemester.name} · ${selectedSemester.start_date} to ${selectedSemester.end_date}`
              : "No semester selected yet"}
          </p>
        </div>
      </div>
      <FormField label="Report semester">
        <Select value={selectedSemester?.id ?? ""} onChange={(event) => onSemesterChange(event.target.value)}>
          {semesters.length === 0 ? <option value="">Create a semester first</option> : null}
          {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
        </Select>
      </FormField>
      {householdId !== null && selectedSemester !== null && calendarChildId !== "" ? <SemesterReportExport key={`${householdId}:${calendarChildId}:${selectedSemester.id}`} householdId={householdId} semesterId={selectedSemester.id} childId={Number(calendarChildId)} /> : null}
      {calendarChildId === "" ? <p>Select a child above to preview a summary.</p> : null}
      {calendarChildId !== "" ? (
        <>
          <div className="dashboard-grid">
            <Card className="metric-card">
              <p className="metric-label">Attendance Days</p>
              <p className="metric-value">{reportUniqueDays}</p>
              <p className="metric-footnote">Unique days with any present subject.</p>
            </Card>
            <Card className="metric-card">
              <p className="metric-label">Subject Entries</p>
              <p className="metric-value">{reportRecords.filter((record) => record.present).length}</p>
              <p className="metric-footnote">Total marked subject sessions.</p>
            </Card>
            <Card className="metric-card">
              <p className="metric-label">Day Notes</p>
              <p className="metric-value">{reportComments.length}</p>
              <p className="metric-footnote">Comments inside the report range.</p>
            </Card>
          </div>
          <ul className="balance-list" aria-label="Subject summary rows">
            {reportSubjectRows.map((row) => (
              <li key={row.subject.id} className="balance-item">
                <div>
                  <p className="balance-name">{row.subject.name}</p>
                  <p className="balance-meta">{row.days} attendance entr{row.days === 1 ? "y" : "ies"}</p>
                </div>
                <div className="balance-pill">Grade: {row.grade}</div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
