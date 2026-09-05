import type {
  HomeschoolAttendance,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
} from "../../../api/models";

export type SubjectSummaryRow = {
  color: string;
  days: number;
  entries: number;
  grade: string;
  name: string;
  subjectId: number;
};

export function countUniquePresentDays(
  attendance: HomeschoolAttendance[],
  semester: HomeschoolSemester | null,
): number {
  return new Set(
    attendance
      .filter(
        (record) => record.present && isWithinSemester(record.date, semester),
      )
      .map((record) => record.date),
  ).size;
}

export function buildSubjectSummaryRows({
  attendance,
  grades,
  semester,
  subjects,
}: {
  attendance: HomeschoolAttendance[];
  grades: HomeschoolGrade[];
  semester: HomeschoolSemester | null;
  subjects: HomeschoolSubject[];
}): SubjectSummaryRow[] {
  const presentRecords = attendance.filter(
    (record) => record.present && isWithinSemester(record.date, semester),
  );

  return subjects.map((subject) => {
    const subjectRecords = presentRecords.filter(
      (record) => record.subject_id === subject.id,
    );
    return {
      color: subject.color,
      days: new Set(subjectRecords.map((record) => record.date)).size,
      entries: subjectRecords.length,
      grade: findGradeLabel(grades, subject.id, semester),
      name: subject.name,
      subjectId: subject.id,
    };
  });
}

export function filterByChild<T extends { child_id: number }>(
  rows: T[],
  childId: number | null,
): T[] {
  if (childId === null) {
    return [];
  }
  return rows.filter((row) => row.child_id === childId);
}

export function sortDatedRecords<T extends { date: string; id: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((left, right) => {
    const dateComparison = right.date.localeCompare(left.date);
    return dateComparison !== 0 ? dateComparison : right.id - left.id;
  });
}

function findGradeLabel(
  grades: HomeschoolGrade[],
  subjectId: number,
  semester: HomeschoolSemester | null,
): string {
  const semesterGrade =
    semester === null
      ? null
      : grades.find(
          (grade) =>
            grade.subject_id === subjectId && grade.semester_id === semester.id,
        );
  const overallGrade = grades.find(
    (grade) => grade.subject_id === subjectId && grade.semester_id === null,
  );
  return semesterGrade?.grade || overallGrade?.grade || "-";
}

function isWithinSemester(
  date: string,
  semester: HomeschoolSemester | null,
): boolean {
  return (
    semester === null ||
    (date >= semester.start_date && date <= semester.end_date)
  );
}
