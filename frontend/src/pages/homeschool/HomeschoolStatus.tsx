import type { ReactElement } from "react";

import type { Child, HomeschoolDayComment, HomeschoolGrade, HomeschoolSemester, HomeschoolSubject } from "../../api";
import { Button, Card } from "../../ui";

type HomeschoolStatusProps = {
  loading: boolean;
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  dayComments: HomeschoolDayComment[];
  selectedChildGrades: HomeschoolGrade[];
  onClearGrade: (gradeId: number) => void;
};

export function HomeschoolStatus({
  loading,
  children,
  semesters,
  subjects,
  dayComments,
  selectedChildGrades,
  onClearGrade,
}: HomeschoolStatusProps): ReactElement {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const semesterLookup = new Map(semesters.map((semester) => [semester.id, semester]));

  return (
    <Card className="dashboard-panel">
      <h2>Current Setup</h2>
      {loading ? <p>Loading homeschool module data...</p> : null}
      {!loading ? (
        <ul className="balance-list">
          <li className="balance-item">Children: {children.map((child) => child.name).join(", ") || "none yet"}</li>
          <li className="balance-item">Semesters: {semesters.map((semester) => semester.name).join(", ") || "none yet"}</li>
          <li className="balance-item">Subjects: {subjects.map((subject) => subject.name).join(", ") || "none yet"}</li>
          <li className="balance-item">Day comments: {dayComments.length}</li>
          <li className="balance-item">Grades: {selectedChildGrades.length}</li>
        </ul>
      ) : null}

      {!loading && selectedChildGrades.length > 0 ? (
        <ul className="balance-list" aria-label="Grade entries">
          {selectedChildGrades.map((record) => (
            <li key={record.id} className="balance-item">
              <div>
                <p className="balance-name">{subjectLookup.get(record.subject_id)?.name || `Subject ${record.subject_id}`}: {record.grade || "—"}</p>
                <p className="balance-meta">{record.semester_id ? semesterLookup.get(record.semester_id)?.name || `Semester ${record.semester_id}` : "Overall"}</p>
              </div>
              <Button type="button" onClick={() => onClearGrade(record.id)}>Clear</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
