import type { RequestQuery } from "./client-core";
import type {
  AuthSessionResponse,
  ChangePasswordRequest,
  Child,
  ChildAccount,
  ChildLoginRequest,
  Chore,
  CreateChildAccountRequest,
  CreateChildRequest,
  CreateChoreRequest,
  CreateHomeschoolSemesterRequest,
  CreateHomeschoolSubjectRequest,
  CreateParentUserRequest,
  CreateRecipeCategoryRequest,
  CreateRecipeRequest,
  CreateRecipeTagRequest,
  DuplicateRecipeRequest,
  EligibleChore,
  HealthResponse,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
  ImportRecipeBackupResponse,
  ListChildrenParams,
  ListChoresParams,
  ListEligibleChoresParams,
  ListRecipesParams,
  ListSubmissionsParams,
  LoginRequest,
  MyModulesResponse,
  NotificationListResponse,
  NotificationSettingResponse,
  NotificationSettingsByModule,
  NotificationSettingUpdate,
  PushConfigResponse,
  PushSubscriptionCreate,
  PushSubscriptionResponse,
  ReadinessResponse,
  RecipeBackup,
  RecipeCategory,
  RecipeDetail,
  RecipeFeedback,
  RecipeScaleResponse,
  RecipeSummary,
  RecipeTag,
  ResetChildAccountEmailRequest,
  ResetChildAccountPasswordRequest,
  SetUserModuleAccessRequest,
  SubmissionItemDecisionRequest,
  SubmissionRequest,
  SubmissionResponse,
  SubmissionReview,
  UpdateChildRequest,
  UpdateChoreRequest,
  UpdateHomeschoolSemesterRequest,
  UpdateHomeschoolSubjectRequest,
  UpdateRecipeRequest,
  UpsertHomeschoolAttendanceRequest,
  UpsertHomeschoolDayCommentRequest,
  UpsertHomeschoolGradeRequest,
  UpsertRecipeFeedbackRequest,
  UserModuleAccess,
} from "./models";

export abstract class FamilyCoreApiEndpoints {
  protected abstract get<TResponse>(path: string, query?: RequestQuery): Promise<TResponse>;
  protected abstract post<TResponse, TBody>(
    path: string,
    body: TBody,
    query?: RequestQuery,
  ): Promise<TResponse>;
  protected abstract put<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  protected abstract patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse>;
  protected abstract delete(path: string, query?: RequestQuery): Promise<void>;
  protected abstract postNoContent(path: string): Promise<void>;
  protected abstract postNoContentWithBody<TBody>(path: string, body: TBody): Promise<void>;

  protected afterAuthSession(_session: AuthSessionResponse): void {}
  protected afterLogout(): void {}

  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health");
  }

  async getLiveness(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health/live");
  }

  async getReadiness(): Promise<ReadinessResponse> {
    return this.get<ReadinessResponse>("/health/ready");
  }

  async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    const session = await this.post<AuthSessionResponse, LoginRequest>("/auth/login", payload);
    this.afterAuthSession(session);
    return session;
  }

  async childLogin(payload: ChildLoginRequest): Promise<AuthSessionResponse> {
    const session = await this.post<AuthSessionResponse, ChildLoginRequest>("/auth/child-login", payload);
    this.afterAuthSession(session);
    return session;
  }

  async getCurrentSession(): Promise<AuthSessionResponse> {
    const session = await this.get<AuthSessionResponse>("/auth/me");
    this.afterAuthSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await this.postNoContent("/auth/logout");
    this.afterLogout();
  }

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await this.postNoContentWithBody("/auth/change-password", payload);
  }

  async getMyModules(): Promise<MyModulesResponse> {
    return this.get<MyModulesResponse>("/modules/me");
  }

  async listUserModuleAccess(): Promise<UserModuleAccess[]> {
    return this.get<UserModuleAccess[]>("/modules/users");
  }

  async createParentUser(payload: CreateParentUserRequest): Promise<UserModuleAccess> {
    return this.post<UserModuleAccess, CreateParentUserRequest>("/modules/users", payload);
  }

  async setUserModuleAccess(userId: number, payload: SetUserModuleAccessRequest): Promise<UserModuleAccess> {
    return this.put<UserModuleAccess, SetUserModuleAccessRequest>(`/modules/users/${userId}`, payload);
  }

  async listNotifications(params: { unread?: number; limit?: number } = {}): Promise<NotificationListResponse> {
    return this.get<NotificationListResponse>("/notifications", params);
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await this.postNoContent(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.post<{ updated: number }, Record<string, never>>("/notifications/read-all", {});
  }

  async getNotificationSettings(): Promise<NotificationSettingsByModule> {
    return this.get<NotificationSettingsByModule>("/notification-settings");
  }

  async updateNotificationSettings(moduleKey: string, payload: NotificationSettingUpdate): Promise<NotificationSettingResponse> {
    return this.put<NotificationSettingResponse, NotificationSettingUpdate>(`/notification-settings/${moduleKey}`, payload);
  }

  async getPushConfig(): Promise<PushConfigResponse> {
    return this.get<PushConfigResponse>("/push/config");
  }

  async createPushSubscription(payload: PushSubscriptionCreate): Promise<PushSubscriptionResponse> {
    return this.post<PushSubscriptionResponse, PushSubscriptionCreate>("/push/subscriptions", payload);
  }

  async listChildren(params: ListChildrenParams): Promise<Child[]> {
    return this.get<Child[]>("/children", params);
  }

  async createChild(payload: CreateChildRequest): Promise<Child> {
    return this.post<Child, CreateChildRequest>("/children", payload);
  }

  async updateChild(childId: number, payload: UpdateChildRequest): Promise<Child> {
    return this.patch<Child, UpdateChildRequest>(`/children/${childId}`, payload);
  }

  async createChildAccount(childId: number, payload: CreateChildAccountRequest): Promise<ChildAccount> {
    return this.post<ChildAccount, CreateChildAccountRequest>(`/children/${childId}/account`, payload);
  }

  async resetChildAccountEmail(childId: number, payload: ResetChildAccountEmailRequest): Promise<ChildAccount> {
    return this.patch<ChildAccount, ResetChildAccountEmailRequest>(`/children/${childId}/account-email`, payload);
  }

  async resetChildAccountPassword(childId: number, payload: ResetChildAccountPasswordRequest): Promise<ChildAccount> {
    return this.patch<ChildAccount, ResetChildAccountPasswordRequest>(`/children/${childId}/account-password`, payload);
  }

  async listHomeschoolSemesters(householdId: number): Promise<HomeschoolSemester[]> {
    return this.get<HomeschoolSemester[]>("/homeschool/semesters", { household_id: householdId });
  }

  async createHomeschoolSemester(payload: CreateHomeschoolSemesterRequest): Promise<HomeschoolSemester> {
    return this.post<HomeschoolSemester, CreateHomeschoolSemesterRequest>("/homeschool/semesters", payload);
  }

  async updateHomeschoolSemester(semesterId: number, payload: UpdateHomeschoolSemesterRequest): Promise<HomeschoolSemester> {
    return this.put<HomeschoolSemester, UpdateHomeschoolSemesterRequest>(`/homeschool/semesters/${semesterId}`, payload);
  }

  async deleteHomeschoolSemester(semesterId: number, householdId: number): Promise<void> {
    return this.delete(`/homeschool/semesters/${semesterId}`, { household_id: householdId });
  }

  async listHomeschoolSubjects(householdId: number): Promise<HomeschoolSubject[]> {
    return this.get<HomeschoolSubject[]>("/homeschool/subjects", { household_id: householdId });
  }

  async createHomeschoolSubject(payload: CreateHomeschoolSubjectRequest): Promise<HomeschoolSubject> {
    return this.post<HomeschoolSubject, CreateHomeschoolSubjectRequest>("/homeschool/subjects", payload);
  }

  async updateHomeschoolSubject(subjectId: number, payload: UpdateHomeschoolSubjectRequest): Promise<HomeschoolSubject> {
    return this.put<HomeschoolSubject, UpdateHomeschoolSubjectRequest>(`/homeschool/subjects/${subjectId}`, payload);
  }

  async deleteHomeschoolSubject(subjectId: number, householdId: number): Promise<void> {
    return this.delete(`/homeschool/subjects/${subjectId}`, { household_id: householdId });
  }

  async listHomeschoolDayComments(householdId: number, childId?: number): Promise<HomeschoolDayComment[]> {
    return this.get<HomeschoolDayComment[]>("/homeschool/day-comments", { household_id: householdId, child_id: childId });
  }

  async upsertHomeschoolDayComment(payload: UpsertHomeschoolDayCommentRequest): Promise<HomeschoolDayComment> {
    return this.put<HomeschoolDayComment, UpsertHomeschoolDayCommentRequest>("/homeschool/day-comments", payload);
  }

  async deleteHomeschoolDayComment(commentId: number, householdId: number): Promise<void> {
    return this.delete(`/homeschool/day-comments/${commentId}`, { household_id: householdId });
  }

  async listHomeschoolGrades(householdId: number, childId?: number): Promise<HomeschoolGrade[]> {
    return this.get<HomeschoolGrade[]>("/homeschool/grades", { household_id: householdId, child_id: childId });
  }

  async upsertHomeschoolGrade(payload: UpsertHomeschoolGradeRequest): Promise<HomeschoolGrade> {
    return this.put<HomeschoolGrade, UpsertHomeschoolGradeRequest>("/homeschool/grades", payload);
  }

  async deleteHomeschoolGrade(gradeId: number, householdId: number): Promise<void> {
    return this.delete(`/homeschool/grades/${gradeId}`, { household_id: householdId });
  }

  async listHomeschoolAttendance(householdId: number, childId?: number): Promise<HomeschoolAttendance[]> {
    return this.get<HomeschoolAttendance[]>("/homeschool/attendance", { household_id: householdId, child_id: childId });
  }

  async upsertHomeschoolAttendance(payload: UpsertHomeschoolAttendanceRequest): Promise<HomeschoolAttendance> {
    return this.put<HomeschoolAttendance, UpsertHomeschoolAttendanceRequest>("/homeschool/attendance", payload);
  }

  async deleteHomeschoolAttendance(attendanceId: number, householdId: number): Promise<void> {
    return this.delete(`/homeschool/attendance/${attendanceId}`, { household_id: householdId });
  }

  async listChores(params: ListChoresParams): Promise<Chore[]> {
    return this.get<Chore[]>("/chores", params);
  }

  async createChore(payload: CreateChoreRequest): Promise<Chore> {
    return this.post<Chore, CreateChoreRequest>("/chores", payload);
  }

  async updateChore(choreId: number, payload: UpdateChoreRequest): Promise<Chore> {
    return this.patch<Chore, UpdateChoreRequest>(`/chores/${choreId}`, payload);
  }

  async archiveChore(choreId: number, householdId: number): Promise<void> {
    return this.delete(`/chores/${choreId}`, { household_id: householdId });
  }

  async listEligibleChores(params: ListEligibleChoresParams): Promise<EligibleChore[]> {
    return this.get<EligibleChore[]>("/children/me/eligible-chores", params);
  }

  async createSubmission(payload: SubmissionRequest, params: { child_id?: number } = {}): Promise<SubmissionResponse> {
    return this.post<SubmissionResponse, SubmissionRequest>("/submissions", payload, params);
  }

  async listSubmissions(params: ListSubmissionsParams = {}): Promise<SubmissionReview[]> {
    return this.get<SubmissionReview[]>("/submissions", params);
  }

  async approveSubmission(submissionId: number): Promise<SubmissionReview> {
    return this.post<SubmissionReview, Record<string, never>>(`/submissions/${submissionId}/approve-all`, {});
  }

  async decideSubmissionItem(
    submissionId: number,
    itemId: number,
    payload: SubmissionItemDecisionRequest,
  ): Promise<SubmissionReview> {
    return this.post<SubmissionReview, SubmissionItemDecisionRequest>(`/submissions/${submissionId}/items/${itemId}/decision`, payload);
  }
}

export abstract class FamilyRecipeApiEndpoints extends FamilyCoreApiEndpoints {
  async listRecipeCategories(): Promise<RecipeCategory[]> {
    return this.get<RecipeCategory[]>("/recipes/categories");
  }

  async createRecipeCategory(payload: CreateRecipeCategoryRequest): Promise<RecipeCategory> {
    return this.post<RecipeCategory, CreateRecipeCategoryRequest>("/recipes/categories", payload);
  }

  async updateRecipeCategory(categoryId: number, payload: CreateRecipeCategoryRequest): Promise<RecipeCategory> {
    return this.put<RecipeCategory, CreateRecipeCategoryRequest>(`/recipes/categories/${categoryId}`, payload);
  }

  async deleteRecipeCategory(categoryId: number): Promise<void> {
    return this.delete(`/recipes/categories/${categoryId}`);
  }

  async listRecipeTags(): Promise<RecipeTag[]> {
    return this.get<RecipeTag[]>("/recipes/tags");
  }

  async createRecipeTag(payload: CreateRecipeTagRequest): Promise<RecipeTag> {
    return this.post<RecipeTag, CreateRecipeTagRequest>("/recipes/tags", payload);
  }

  async updateRecipeTag(tagId: number, payload: CreateRecipeTagRequest): Promise<RecipeTag> {
    return this.put<RecipeTag, CreateRecipeTagRequest>(`/recipes/tags/${tagId}`, payload);
  }

  async deleteRecipeTag(tagId: number): Promise<void> {
    return this.delete(`/recipes/tags/${tagId}`);
  }

  async listRecipes(params: ListRecipesParams = {}): Promise<RecipeSummary[]> {
    return this.get<RecipeSummary[]>("/recipes", params as RequestQuery);
  }

  async getRecipe(recipeId: number): Promise<RecipeDetail> {
    return this.get<RecipeDetail>(`/recipes/${recipeId}`);
  }

  async createRecipe(payload: CreateRecipeRequest): Promise<RecipeDetail> {
    return this.post<RecipeDetail, CreateRecipeRequest>("/recipes", payload);
  }

  async importRecipeFromUrl(url: string): Promise<RecipeDetail> {
    return this.post<RecipeDetail, { url: string }>("/recipes/import-url", { url });
  }

  async exportRecipeBackup(): Promise<RecipeBackup> {
    return this.get<RecipeBackup>("/recipes/backup");
  }

  async importRecipeBackup(recipes: CreateRecipeRequest[]): Promise<ImportRecipeBackupResponse> {
    return this.post<ImportRecipeBackupResponse, { recipes: CreateRecipeRequest[] }>("/recipes/backup/import", { recipes });
  }

  async updateRecipe(recipeId: number, payload: UpdateRecipeRequest): Promise<RecipeDetail> {
    return this.put<RecipeDetail, UpdateRecipeRequest>(`/recipes/${recipeId}`, payload);
  }

  async archiveRecipe(recipeId: number, archived: boolean): Promise<RecipeDetail> {
    return this.patch<RecipeDetail, { archived: boolean }>(`/recipes/${recipeId}/archive`, { archived });
  }

  async deleteRecipe(recipeId: number): Promise<void> {
    return this.delete(`/recipes/${recipeId}`);
  }

  async duplicateRecipe(recipeId: number, payload: DuplicateRecipeRequest): Promise<RecipeDetail> {
    return this.post<RecipeDetail, DuplicateRecipeRequest>(`/recipes/${recipeId}/duplicate`, payload);
  }

  async createRecipeVariant(recipeId: number, payload: CreateRecipeRequest): Promise<RecipeDetail> {
    return this.post<RecipeDetail, CreateRecipeRequest>(`/recipes/${recipeId}/variants`, payload);
  }

  async upsertRecipeFeedback(recipeId: number, payload: UpsertRecipeFeedbackRequest): Promise<RecipeFeedback> {
    return this.put<RecipeFeedback, UpsertRecipeFeedbackRequest>(`/recipes/${recipeId}/feedback`, payload);
  }

  async scaleRecipe(recipeId: number, options: { targetServings?: number; scaleFactor?: number }): Promise<RecipeScaleResponse> {
    return this.get<RecipeScaleResponse>(`/recipes/${recipeId}/scale`, {
      target_servings: options.targetServings,
      scale_factor: options.scaleFactor,
    });
  }
}
