import type {
  AttendanceFormState,
  DayCommentFormState,
  GradeFormState,
  SubjectFormState,
} from "./defaults";

export function validateSemesterForm({
  endDate,
  name,
  startDate,
}: {
  endDate: string;
  name: string;
  startDate: string;
}): string | null {
  if (name.trim().length === 0) {
    return "Semester name is required.";
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return "Semester dates must use YYYY-MM-DD.";
  }
  if (endDate < startDate) {
    return "Semester end date must be on or after the start date.";
  }
  return null;
}

export function validateSubjectForm(form: SubjectFormState): string | null {
  return form.name.trim().length === 0 ? "Subject name is required." : null;
}

export function validateAttendanceForm(
  form: AttendanceFormState,
): string | null {
  return form.childId === "" || form.subjectId === ""
    ? "Choose a child and subject first."
    : null;
}

export function validateCommentForm(form: DayCommentFormState): string | null {
  return form.childId === "" ? "Choose a child first." : null;
}

export function validateGradeForm(form: GradeFormState): string | null {
  return form.childId === "" || form.subjectId === ""
    ? "Choose a child and subject first."
    : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
