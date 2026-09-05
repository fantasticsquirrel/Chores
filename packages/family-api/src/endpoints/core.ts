import type {
  Child,
  ChildAccount,
  CreateChildAccountRequest,
  CreateChildRequest,
  ListChildrenParams,
  ResetChildAccountEmailRequest,
  ResetChildAccountPasswordRequest,
  UpdateChildRequest,
} from "../models/children";
import type {
  Chore,
  CreateChoreRequest,
  EligibleChore,
  ListChoresParams,
  ListEligibleChoresParams,
  ListSubmissionsParams,
  SubmissionItemDecisionRequest,
  SubmissionRequest,
  SubmissionResponse,
  SubmissionReview,
  UpdateChoreRequest,
} from "../models/chores";
import type {
  ChildBalance,
  ChoreTransaction,
  CreateChoreTransactionRequest,
} from "../models/finance";
import type {
  CreateHomeschoolSemesterRequest,
  CreateHomeschoolSubjectRequest,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
  UpdateHomeschoolSemesterRequest,
  UpdateHomeschoolSubjectRequest,
  UpsertHomeschoolAttendanceRequest,
  UpsertHomeschoolDayCommentRequest,
  UpsertHomeschoolGradeRequest,
} from "../models/homeschool";
import { FamilyNotificationApiEndpoints } from "./notifications";

export abstract class FamilyCoreApiEndpoints extends FamilyNotificationApiEndpoints {
  async listChildren(params: ListChildrenParams): Promise<Child[]> {
    return this.get<Child[]>("/children", params);
  }

  async createChild(payload: CreateChildRequest): Promise<Child> {
    return this.post<Child, CreateChildRequest>("/children", payload);
  }

  async updateChild(childId: number, payload: UpdateChildRequest): Promise<Child> {
    return this.patch<Child, UpdateChildRequest>(`/children/${childId}`, payload);
  }

  async createChildAccount(
    childId: number,
    payload: CreateChildAccountRequest,
  ): Promise<ChildAccount> {
    return this.post<ChildAccount, CreateChildAccountRequest>(
      `/children/${childId}/account`,
      payload,
    );
  }

  async resetChildAccountEmail(
    childId: number,
    payload: ResetChildAccountEmailRequest,
  ): Promise<ChildAccount> {
    return this.patch<ChildAccount, ResetChildAccountEmailRequest>(
      `/children/${childId}/account-email`,
      payload,
    );
  }

  async resetChildAccountPassword(
    childId: number,
    payload: ResetChildAccountPasswordRequest,
  ): Promise<ChildAccount> {
    return this.patch<ChildAccount, ResetChildAccountPasswordRequest>(
      `/children/${childId}/account-password`,
      payload,
    );
  }

  async listHomeschoolSemesters(
    householdId: number,
  ): Promise<HomeschoolSemester[]> {
    return this.get<HomeschoolSemester[]>("/homeschool/semesters", {
      household_id: householdId,
    });
  }

  async createHomeschoolSemester(
    payload: CreateHomeschoolSemesterRequest,
  ): Promise<HomeschoolSemester> {
    return this.post<HomeschoolSemester, CreateHomeschoolSemesterRequest>(
      "/homeschool/semesters",
      payload,
    );
  }

  async updateHomeschoolSemester(
    semesterId: number,
    payload: UpdateHomeschoolSemesterRequest,
  ): Promise<HomeschoolSemester> {
    return this.put<HomeschoolSemester, UpdateHomeschoolSemesterRequest>(
      `/homeschool/semesters/${semesterId}`,
      payload,
    );
  }

  async deleteHomeschoolSemester(
    semesterId: number,
    householdId: number,
  ): Promise<void> {
    return this.delete(`/homeschool/semesters/${semesterId}`, {
      household_id: householdId,
    });
  }

  async listHomeschoolSubjects(
    householdId: number,
  ): Promise<HomeschoolSubject[]> {
    return this.get<HomeschoolSubject[]>("/homeschool/subjects", {
      household_id: householdId,
    });
  }

  async createHomeschoolSubject(
    payload: CreateHomeschoolSubjectRequest,
  ): Promise<HomeschoolSubject> {
    return this.post<HomeschoolSubject, CreateHomeschoolSubjectRequest>(
      "/homeschool/subjects",
      payload,
    );
  }

  async updateHomeschoolSubject(
    subjectId: number,
    payload: UpdateHomeschoolSubjectRequest,
  ): Promise<HomeschoolSubject> {
    return this.put<HomeschoolSubject, UpdateHomeschoolSubjectRequest>(
      `/homeschool/subjects/${subjectId}`,
      payload,
    );
  }

  async deleteHomeschoolSubject(
    subjectId: number,
    householdId: number,
  ): Promise<void> {
    return this.delete(`/homeschool/subjects/${subjectId}`, {
      household_id: householdId,
    });
  }

  async listHomeschoolDayComments(
    householdId: number,
    childId?: number,
  ): Promise<HomeschoolDayComment[]> {
    return this.get<HomeschoolDayComment[]>("/homeschool/day-comments", {
      household_id: householdId,
      child_id: childId,
    });
  }

  async upsertHomeschoolDayComment(
    payload: UpsertHomeschoolDayCommentRequest,
  ): Promise<HomeschoolDayComment> {
    return this.put<HomeschoolDayComment, UpsertHomeschoolDayCommentRequest>(
      "/homeschool/day-comments",
      payload,
    );
  }

  async deleteHomeschoolDayComment(
    commentId: number,
    householdId: number,
  ): Promise<void> {
    return this.delete(`/homeschool/day-comments/${commentId}`, {
      household_id: householdId,
    });
  }

  async listHomeschoolGrades(
    householdId: number,
    childId?: number,
  ): Promise<HomeschoolGrade[]> {
    return this.get<HomeschoolGrade[]>("/homeschool/grades", {
      household_id: householdId,
      child_id: childId,
    });
  }

  async upsertHomeschoolGrade(
    payload: UpsertHomeschoolGradeRequest,
  ): Promise<HomeschoolGrade> {
    return this.put<HomeschoolGrade, UpsertHomeschoolGradeRequest>(
      "/homeschool/grades",
      payload,
    );
  }

  async deleteHomeschoolGrade(
    gradeId: number,
    householdId: number,
  ): Promise<void> {
    return this.delete(`/homeschool/grades/${gradeId}`, {
      household_id: householdId,
    });
  }

  async listHomeschoolAttendance(
    householdId: number,
    childId?: number,
  ): Promise<HomeschoolAttendance[]> {
    return this.get<HomeschoolAttendance[]>("/homeschool/attendance", {
      household_id: householdId,
      child_id: childId,
    });
  }

  async upsertHomeschoolAttendance(
    payload: UpsertHomeschoolAttendanceRequest,
  ): Promise<HomeschoolAttendance> {
    return this.put<HomeschoolAttendance, UpsertHomeschoolAttendanceRequest>(
      "/homeschool/attendance",
      payload,
    );
  }

  async deleteHomeschoolAttendance(
    attendanceId: number,
    householdId: number,
  ): Promise<void> {
    return this.delete(`/homeschool/attendance/${attendanceId}`, {
      household_id: householdId,
    });
  }

  async listChores(params: ListChoresParams): Promise<Chore[]> {
    return this.get<Chore[]>("/chores", params);
  }

  async createChore(payload: CreateChoreRequest): Promise<Chore> {
    return this.post<Chore, CreateChoreRequest>("/chores", payload);
  }

  async updateChore(
    choreId: number,
    payload: UpdateChoreRequest,
  ): Promise<Chore> {
    return this.patch<Chore, UpdateChoreRequest>(`/chores/${choreId}`, payload);
  }

  async archiveChore(choreId: number, householdId: number): Promise<void> {
    return this.delete(`/chores/${choreId}`, { household_id: householdId });
  }

  async listMyParentTasks(date: string): Promise<Chore[]> {
    return this.get<Chore[]>("/chores/me/today", { date });
  }

  async completeParentTask(choreId: number, date: string): Promise<void> {
    await this.postNoContent(
      `/chores/${choreId}/complete?date=${encodeURIComponent(date)}`,
    );
  }

  async listChildBalances(): Promise<ChildBalance[]> {
    return this.get<ChildBalance[]>("/finance/balances");
  }

  async listChoreTransactions(childId: number): Promise<ChoreTransaction[]> {
    return this.get<ChoreTransaction[]>("/finance/transactions", {
      child_id: childId,
    });
  }

  async createChoreTransaction(
    payload: CreateChoreTransactionRequest,
  ): Promise<ChoreTransaction> {
    return this.post<ChoreTransaction, CreateChoreTransactionRequest>(
      "/finance/transactions",
      payload,
    );
  }

  async listEligibleChores(
    params: ListEligibleChoresParams,
  ): Promise<EligibleChore[]> {
    return this.get<EligibleChore[]>(
      "/children/me/eligible-chores",
      params,
    );
  }

  async createSubmission(
    payload: SubmissionRequest,
    params: { child_id?: number } = {},
  ): Promise<SubmissionResponse> {
    return this.post<SubmissionResponse, SubmissionRequest>(
      "/submissions",
      payload,
      params,
    );
  }

  async listSubmissions(
    params: ListSubmissionsParams = {},
  ): Promise<SubmissionReview[]> {
    return this.get<SubmissionReview[]>("/submissions", params);
  }

  async approveSubmission(submissionId: number): Promise<SubmissionReview> {
    return this.post<SubmissionReview, Record<string, never>>(
      `/submissions/${submissionId}/approve-all`,
      {},
    );
  }

  async decideSubmissionItem(
    submissionId: number,
    itemId: number,
    payload: SubmissionItemDecisionRequest,
  ): Promise<SubmissionReview> {
    return this.post<SubmissionReview, SubmissionItemDecisionRequest>(
      `/submissions/${submissionId}/items/${itemId}/decision`,
      payload,
    );
  }
}
