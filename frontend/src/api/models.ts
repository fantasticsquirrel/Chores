export interface ApiErrorResponse {
  detail?: unknown;
}

export type UserRole = "PARENT_ADMIN" | "PARENT" | "CHILD";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthUser {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id?: number | null;
}

export interface AuthSessionResponse {
  user: AuthUser;
  csrf_token?: string | null;
}

export interface HealthResponse {
  status: string;
}

export interface ReadinessResponse {
  status: string;
  [key: string]: unknown;
}

export interface Child {
  id: number;
  household_id: number;
  name: string;
  active: boolean;
}

export interface ListChildrenParams {
  household_id: number;
  active_only?: boolean;
}

export interface CreateChildRequest {
  household_id: number;
  name: string;
  active?: boolean;
}

export interface UpdateChildRequest {
  household_id: number;
  name?: string;
  active?: boolean;
}

export interface CreateChildAccountRequest {
  household_id: number;
  email?: string | null;
  password: string;
}

export interface ResetChildAccountEmailRequest {
  household_id: number;
  email?: string | null;
}

export interface ChildAccount {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id: number;
}

export interface EligibleChore {
  chore_id: number;
  name: string;
  reward_cents: number;
  occurrence_date: string;
  expires_on?: string | null;
}

export interface ListEligibleChoresParams {
  date: string;
  child_id?: number;
}

export interface SubmissionRequest {
  for_date: string;
  chore_ids: number[];
}

export interface SubmissionItemResponse {
  chore_id: number;
  status: string;
}

export interface SubmissionResponse {
  id: number;
  child_id: number;
  for_date: string;
  status: string;
  items: SubmissionItemResponse[];
}

export interface SubmissionReviewItem {
  id: number;
  chore_id: number;
  chore_name: string;
  chore_reward_cents: number;
  status: string;
}

export interface SubmissionReview {
  id: number;
  child_id: number;
  child_name: string;
  for_date: string;
  status: string;
  items: SubmissionReviewItem[];
}

export interface ListSubmissionsParams {
  status?: string;
}

export interface SubmissionItemDecisionRequest {
  status: "APPROVED" | "REJECTED";
}

export type ScheduleMode = "NONE" | "EVERY" | "AFTER_COMPLETION" | "ONCE";
export type ScheduleUnit = "DAY" | "WEEK" | "MONTH";
export type CompletionMode = "PER_CHILD" | "SHARED";
export type AssignmentMode = "STATIC" | "ROTATING";

export interface Chore {
  id: number;
  household_id: number;
  name: string;
  reward_cents: number;
  reward_dollars: number;
  start_date: string;
  expires_at: string | null;
  timeout_days: number | null;
  schedule_mode: ScheduleMode;
  schedule_interval: number | null;
  schedule_unit: ScheduleUnit | null;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
  archived_at: string | null;
  is_active: boolean;
  allowed_child_ids: number[];
  rotation_order: number[];
}

export interface ListChoresParams {
  household_id: number;
  active_only?: boolean;
}

export interface CreateChoreRequest {
  household_id: number;
  name: string;
  reward_cents: number;
  start_date: string;
  expires_at?: string | null;
  timeout_days?: number | null;
  schedule_mode: ScheduleMode;
  schedule_interval?: number | null;
  schedule_unit?: ScheduleUnit | null;
  completion_mode: CompletionMode;
  assignment_mode: AssignmentMode;
  allowed_child_ids: number[];
  rotation_order: number[];
}

export interface UpdateChoreRequest {
  household_id: number;
  name?: string;
  reward_cents?: number;
  start_date?: string;
  expires_at?: string | null;
  timeout_days?: number | null;
  schedule_mode?: ScheduleMode;
  schedule_interval?: number | null;
  schedule_unit?: ScheduleUnit | null;
  completion_mode?: CompletionMode;
  assignment_mode?: AssignmentMode;
  allowed_child_ids?: number[] | null;
  rotation_order?: number[] | null;
}

export interface FamilyModule {
  key: "chores" | "homeschool" | "admin";
  name: string;
  description: string;
}

export interface MyModulesResponse {
  modules: FamilyModule[];
}

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

export type HomeschoolSubjectArea =
  | "math"
  | "science"
  | "grammar"
  | "vocabulary";

export type HomeschoolProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_review";

export interface HomeschoolCourseStudentSummary {
  child_id: number;
  child_name: string;
  lesson_count: number;
  completed_count: number;
  in_progress_count: number;
  needs_review_count: number;
  completion_percent: number;
}

export interface HomeschoolCourse {
  id: number;
  household_id: number;
  subject_area: HomeschoolSubjectArea;
  grade_level: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  active: boolean;
  archived_at: string | null;
  assigned_child_ids: number[];
  lesson_count: number;
  completed_count: number;
  in_progress_count: number;
  needs_review_count: number;
  completion_percent: number;
  student_summaries: HomeschoolCourseStudentSummary[];
}

export interface CreateHomeschoolCourseRequest {
  household_id: number;
  subject_area: HomeschoolSubjectArea;
  grade_level: number;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  active?: boolean;
  assigned_child_ids: number[];
}

export type UpdateHomeschoolCourseRequest = CreateHomeschoolCourseRequest;

export interface ListHomeschoolCoursesParams {
  household_id: number;
  subject_area?: HomeschoolSubjectArea;
  active_only?: boolean;
}

export interface HomeschoolLesson {
  id: number;
  household_id: number;
  course_id: number;
  title: string;
  overview: string;
  sequence_order: number;
  estimated_minutes: number | null;
  activity_prompt: string;
  answer_key: string;
  learning_objectives: string;
  materials: string;
  warm_up: string;
  direct_instruction: string;
  guided_practice: string;
  independent_practice: string;
  assessment: string;
  extension: string;
  remediation: string;
  archived_at: string | null;
}

export interface CreateHomeschoolLessonRequest {
  household_id: number;
  title: string;
  overview?: string;
  sequence_order: number;
  estimated_minutes?: number | null;
  activity_prompt?: string;
  answer_key?: string;
  learning_objectives?: string;
  materials?: string;
  warm_up?: string;
  direct_instruction?: string;
  guided_practice?: string;
  independent_practice?: string;
  assessment?: string;
  extension?: string;
  remediation?: string;
}

export type UpdateHomeschoolLessonRequest = CreateHomeschoolLessonRequest;

export interface HomeschoolProgress {
  id: number;
  household_id: number;
  child_id: number;
  course_id: number;
  lesson_id: number;
  status: HomeschoolProgressStatus;
  score_percent: number | null;
  completed_at: string | null;
  notes: string;
}

export interface UpsertHomeschoolProgressRequest {
  household_id: number;
  child_id: number;
  lesson_id: number;
  status: HomeschoolProgressStatus;
  score_percent?: number | null;
  completed_at?: string | null;
  notes?: string;
}

export interface HomeschoolStudentLearningSummary {
  child_id: number;
  child_name: string;
  active: boolean;
  assigned_course_count: number;
  lesson_count: number;
  completed_count: number;
  needs_review_count: number;
  completion_percent: number;
}

export interface HomeschoolLearningSummary {
  students: HomeschoolStudentLearningSummary[];
  courses: HomeschoolCourse[];
  progress_records: HomeschoolProgress[];
}

export interface BuiltInMathLesson {
  sequence_order: number;
  title: string;
  overview: string;
  estimated_minutes: number;
  activity_prompt: string;
  answer_key: string;
  learning_objectives: string;
  materials: string;
  warm_up: string;
  direct_instruction: string;
  guided_practice: string;
  independent_practice: string;
  assessment: string;
  extension: string;
  remediation: string;
}

export interface BuiltInMathCourse {
  grade_level: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  topics: string[];
  lessons: BuiltInMathLesson[];
}

export interface ImportBuiltInMathCourseRequest {
  household_id: number;
  grade_level: number;
  assigned_child_ids: number[];
}

export interface UserModuleAccess {
  id: number;
  household_id: number;
  email: string;
  role: UserRole;
  child_id?: number | null;
  modules: FamilyModule[];
}

export interface CreateParentUserRequest {
  email: string;
  password: string;
  role: "PARENT" | "PARENT_ADMIN";
}

export interface SetUserModuleAccessRequest {
  module_key: "chores" | "homeschool" | "admin";
  can_view: boolean;
  can_manage?: boolean;
}
