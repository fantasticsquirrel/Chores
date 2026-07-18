import type { FamilyModuleKey } from "./modules";

export interface ApiErrorResponse {
  detail?: unknown;
}

export type UserRole = "PARENT_ADMIN" | "PARENT" | "CHILD";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChildLoginRequest {
  parent_email: string;
  child_name: string;
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
  is_household_owner: boolean;
}

export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "grace_period"
  | "billing_retry"
  | "canceled_active"
  | "expired"
  | "refunded"
  | "revoked"
  | "complimentary";

export interface BillingAvailableAction {
  key: string;
  label: string;
}

export interface HouseholdOwnershipResponse {
  household_id: number;
  owner_user_id: number;
  owner_email: string;
}

export interface TransferHouseholdOwnershipRequest {
  new_owner_user_id: number;
  reason: string;
}

export interface BillingStatusResponse {
  status: BillingStatus;
  provider: string | null;
  plan_name: string | null;
  expires_at: string | null;
  current_period_ends_at: string | null;
  available_actions: BillingAvailableAction[];
}

export interface BillingActionRequest { action: string }
export interface BillingActionResponse { message: string; redirect_url?: string | null }

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

export interface ResetChildAccountPasswordRequest {
  household_id: number;
  new_password: string;
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

export interface RecipeCategory {
  id: number;
  household_id: number;
  owner_user_id: number;
  name: string;
  color: string;
}

export interface RecipeTag {
  id: number;
  household_id: number;
  owner_user_id: number;
  name: string;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  position: number;
  group_name: string;
  quantity: number | null;
  unit: string;
  item: string;
  preparation: string;
  note: string;
  is_optional: boolean;
}

export interface RecipeStep {
  id: number;
  recipe_id: number;
  position: number;
  section: string;
  instruction: string;
  ingredient_position_refs: number[];
  ingredient_ids: number[];
}

export interface RecipeSummary {
  id: number;
  household_id: number;
  owner_user_id: number;
  creator_email?: string;
  parent_recipe_id: number | null;
  title: string;
  description: string;
  photo_url: string | null;
  source_name: string;
  source_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  yield_quantity: number | null;
  yield_unit: string;
  rating: number | null;
  favorite: boolean;
  notes: string;
  archived_at: string | null;
  categories: RecipeCategory[];
  tags: RecipeTag[];
  ingredient_count: number;
  feedback_summary: RecipeFeedbackSummary;
}

export type RecipeFeedbackReviewerType = "PARENT" | "CHILD";

export interface RecipeFeedbackSummary {
  average_rating: number | null;
  rating_count: number;
}

export interface RecipeFeedback {
  id: number;
  recipe_id: number;
  household_id: number;
  reviewer_type: RecipeFeedbackReviewerType;
  parent_user_id: number | null;
  child_id: number | null;
  reviewer_name: string;
  rating: number | null;
  verdict: string;
  notes: string;
  created_at: string;
}

export interface RecipeComponent {
  component_recipe_id: number;
  label: string;
  quantity: number | null;
  unit: string;
  component_recipe: RecipeSummary;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  components: RecipeComponent[];
  variants: RecipeSummary[];
  core_recipe: RecipeSummary | null;
  feedback: RecipeFeedback[];
}

export interface CreateRecipeCategoryRequest {
  name: string;
  color?: string;
}

export type UpdateRecipeCategoryRequest = CreateRecipeCategoryRequest;

export interface CreateRecipeTagRequest {
  name: string;
}

export type UpdateRecipeTagRequest = CreateRecipeTagRequest;

export interface RecipeIngredientRequest {
  position: number;
  group_name?: string;
  quantity?: number | null;
  unit?: string;
  item: string;
  preparation?: string;
  note?: string;
  is_optional?: boolean;
}

export interface RecipeStepRequest {
  position: number;
  section?: string;
  instruction: string;
  ingredient_position_refs?: number[];
}

export interface RecipeComponentRequest {
  component_recipe_id: number;
  label?: string;
  quantity?: number | null;
  unit?: string;
}

export interface CreateRecipeRequest {
  parent_recipe_id?: number | null;
  title: string;
  description?: string;
  photo_url?: string | null;
  source_name?: string;
  source_url?: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  servings?: number | null;
  yield_quantity?: number | null;
  yield_unit?: string;
  rating?: number | null;
  favorite?: boolean;
  notes?: string;
  category_ids?: number[];
  tag_ids?: number[];
  ingredients?: RecipeIngredientRequest[];
  steps?: RecipeStepRequest[];
  components?: RecipeComponentRequest[];
}

export type UpdateRecipeRequest = CreateRecipeRequest;

export interface ListRecipesParams {
  query?: string;
  category_id?: number;
  tag_id?: number;
  favorite?: boolean;
  min_rating?: number;
  ingredient?: string;
  active_only?: boolean;
}

export interface DuplicateRecipeRequest {
  title?: string | null;
  as_variant?: boolean;
}

export interface ImportRecipeBackupResponse {
  imported_count: number;
  recipes: RecipeDetail[];
}

export interface RecipeBackup {
  version: number;
  recipes: RecipeDetail[];
}

export interface UpsertRecipeFeedbackRequest {
  reviewer_type: RecipeFeedbackReviewerType;
  parent_user_id?: number | null;
  child_id?: number | null;
  rating?: number | null;
  verdict?: string;
  notes?: string;
}

export interface RecipeScaleResponse {
  recipe_id: number;
  base_servings: number | null;
  target_servings: number | null;
  factor: number;
  warnings: string[];
  ingredients: Array<RecipeIngredient & { scaled_quantity: number | null }>;
  steps: Array<RecipeStep & {
    scaled_instruction: string;
    linked_ingredients: Array<RecipeIngredient & { scaled_quantity: number | null }>;
  }>;
}

export interface FamilyModule {
  key: FamilyModuleKey;
  name: string;
  description: string;
  can_manage?: boolean;
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
  module_key: FamilyModuleKey;
  can_view: boolean;
  can_manage?: boolean;
}

export interface NotificationItem {
  id: number;
  module_key: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  link_url: string;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export interface NotificationSettings {
  in_app_enabled: boolean;
  push_enabled: boolean;
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  due_soon_enabled: boolean;
  due_soon_hours: number;
  approval_notifications_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export type NotificationSettingsByModule = Record<string, NotificationSettings>;

export type NotificationSettingUpdate = Partial<NotificationSettings>;

export interface NotificationSettingResponse {
  module_key: string;
  settings: NotificationSettings;
}

export interface PushConfigResponse {
  vapid_public_key: string;
}

export interface PushSubscriptionCreate {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_label?: string;
}

export interface PushSubscriptionResponse {
  id: number;
  endpoint: string;
  device_label: string;
  enabled: boolean;
  created_at: string;
  last_seen_at: string;
}
