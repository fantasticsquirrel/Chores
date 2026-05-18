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
  onDeleteSemester: (semesterId: number) => void;
  onDeleteSubject: (subjectId: number) => void;
};

export function HomeschoolStatus({
  loading,
  children,
  semesters,
  subjects,
  dayComments,
  selectedChildGrades,
  onClearGrade,
  onDeleteSemester,
  onDeleteSubject,
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
          <li className="balance-item">Semesters: {semesters.length}</li>
          <li className="balance-item">Subjects: {subjects.length}</li>
          <li className="balance-item">Day comments: {dayComments.length}</li>
          <li className="balance-item">Grades: {selectedChildGrades.length}</li>
        </ul>
      ) : null}

      {!loading && subjects.length > 0 ? (
        <ul className="balance-list" aria-label="Subject entries">
          {subjects.map((subject) => (
            <li key={subject.id} className="balance-item">
              <div>
                <p className="balance-name">{subject.name}</p>
                <p className="balance-meta">{subject.color}</p>
              </div>
              <Button type="button" onClick={() => onDeleteSubject(subject.id)}>Delete</Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && semesters.length > 0 ? (
        <ul className="balance-list" aria-label="Semester entries">
          {semesters.map((semester) => (
            <li key={semester.id} className="balance-item">
              <div>
                <p className="balance-name">{semester.name}</p>
                <p className="balance-meta">{semester.start_date} to {semester.end_date}</p>
              </div>
              <Button type="button" onClick={() => onDeleteSemester(semester.id)}>Delete</Button>
            </li>
          ))}
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
