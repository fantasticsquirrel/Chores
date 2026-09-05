export type SemesterFormState = {
  active: boolean;
  end_date: string;
  name: string;
  start_date: string;
};

export type SubjectFormState = {
  active: boolean;
  color: string;
  name: string;
};

export type AttendanceFormState = {
  childId: string;
  comment: string;
  date: string;
  present: boolean;
  subjectId: string;
};

export type DayCommentFormState = {
  childId: string;
  comment: string;
  date: string;
};

export type GradeFormState = {
  childId: string;
  grade: string;
  semesterId: string;
  subjectId: string;
};

export function buildDefaultSemesterForm(today: string): SemesterFormState {
  return {
    active: true,
    end_date: today,
    name: "",
    start_date: today,
  };
}

export function buildDefaultSubjectForm(): SubjectFormState {
  return {
    active: true,
    color: "#3b82f6",
    name: "",
  };
}

export function buildDefaultAttendanceForm(today: string): AttendanceFormState {
  return {
    childId: "",
    comment: "",
    date: today,
    present: true,
    subjectId: "",
  };
}

export function buildDefaultCommentForm(today: string): DayCommentFormState {
  return {
    childId: "",
    comment: "",
    date: today,
  };
}

export function buildDefaultGradeForm(): GradeFormState {
  return {
    childId: "",
    grade: "",
    semesterId: "",
    subjectId: "",
  };
}
