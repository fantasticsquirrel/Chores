import type { ReactElement } from "react";

import type { HomeschoolAttendance, HomeschoolDayComment, HomeschoolGrade, HomeschoolSemester, HomeschoolSubject } from "../../api";
import { Card } from "../../ui";

type HomeschoolSummaryProps = {
  calendarChildId: string;
  selectedSemester: HomeschoolSemester | null;
  selectedChildAttendance: HomeschoolAttendance[];
  selectedChildComments: HomeschoolDayComment[];
  selectedChildGrades: HomeschoolGrade[];
  subjects: HomeschoolSubject[];
};

export function HomeschoolSummary({
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
    )?.grade || selectedChildGrades.find((record) => record.subject_id === subject.id && record.semester_id === null)?.grade || "—",
  }));
  const reportUniqueDays = new Set(reportRecords.filter((record) => record.present).map((record) => record.date)).size;

  return (
    <Card className="dashboard-panel">
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
