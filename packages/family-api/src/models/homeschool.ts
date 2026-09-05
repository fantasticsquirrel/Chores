export interface HomeschoolSemester {
  id: number;
  household_id: number;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface HomeschoolSubject {
  id: number;
  household_id: number;
  name: string;
  color: string;
  active: boolean;
}

export interface HomeschoolAttendance {
  id: number;
  household_id: number;
  child_id: number;
  subject_id: number;
  date: string;
  present: boolean;
  comment: string;
}

export interface CreateHomeschoolSemesterRequest {
  household_id: number;
  name: string;
  start_date: string;
  end_date: string;
  active?: boolean;
}

export type UpdateHomeschoolSemesterRequest = CreateHomeschoolSemesterRequest;

export interface CreateHomeschoolSubjectRequest {
  household_id: number;
  name: string;
  color?: string;
  active?: boolean;
}

export type UpdateHomeschoolSubjectRequest = CreateHomeschoolSubjectRequest;

export interface UpsertHomeschoolAttendanceRequest {
  household_id: number;
  child_id: number;
  subject_id: number;
  date: string;
  present?: boolean;
  comment?: string;
}

export interface HomeschoolDayComment {
  id: number;
  household_id: number;
  child_id: number;
  date: string;
  comment: string;
}

export interface UpsertHomeschoolDayCommentRequest {
  household_id: number;
  child_id: number;
  date: string;
  comment: string;
}

export interface HomeschoolGrade {
  id: number;
  household_id: number;
  child_id: number;
  subject_id: number;
  semester_id: number | null;
  grade: string;
}

export interface UpsertHomeschoolGradeRequest {
  household_id: number;
  child_id: number;
  subject_id: number;
  semester_id?: number | null;
  grade: string;
}
