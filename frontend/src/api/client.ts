import type {
  ApiErrorResponse,
  AuthSessionResponse,
  ChangePasswordRequest,
  Child,
  ChildAccount,
  Chore,
  CreateChildAccountRequest,
  CreateChildRequest,
  CreateChoreRequest,
  CreateHomeschoolSemesterRequest,
  CreateHomeschoolSubjectRequest,
  EligibleChore,
  HealthResponse,
  HomeschoolAttendance,
  HomeschoolSemester,
  HomeschoolSubject,
  LoginRequest,
  ListChoresParams,
  ListEligibleChoresParams,
  ListSubmissionsParams,
  ListChildrenParams,
  MyModulesResponse,
  ReadinessResponse,
  ResetChildAccountEmailRequest,
  SubmissionItemDecisionRequest,
  SubmissionReview,
  SubmissionRequest,
  SubmissionResponse,
  UpdateChildRequest,
  UpdateChoreRequest,
  UpsertHomeschoolAttendanceRequest,
} from "./models";

export const DEFAULT_API_BASE_URL = "/chore-api";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_COOKIE_NAME = "chore_tracker_csrf";

type QueryValue = string | number | boolean | undefined;

type RequestQuery = Record<string, QueryValue>;

export class ApiClientError extends Error {
  status: number;
  detail: string;
  data: unknown;

  constructor(status: number, detail: string, data: unknown) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

export type ApiClientConfig = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private csrfToken: string | null;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? resolveApiBaseUrl());
    this.fetchImpl = resolveFetchImpl(config.fetchImpl);
    this.csrfToken = readCookieValue(CSRF_COOKIE_NAME);
  }

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
    this.csrfToken = session.csrf_token ?? readCookieValue(CSRF_COOKIE_NAME);
    return session;
  }

  async getCurrentSession(): Promise<AuthSessionResponse> {
    const session = await this.get<AuthSessionResponse>("/auth/me");
    this.csrfToken = session.csrf_token ?? this.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME);
    return session;
  }

  async logout(): Promise<void> {
    await this.postNoContent("/auth/logout");
    this.csrfToken = null;
  }

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await this.postNoContentWithBody("/auth/change-password", payload);
  }

  async getMyModules(): Promise<MyModulesResponse> {
    return this.get<MyModulesResponse>("/modules/me");
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

  async listHomeschoolSemesters(householdId: number): Promise<HomeschoolSemester[]> {
    return this.get<HomeschoolSemester[]>("/homeschool/semesters", { household_id: householdId });
  }

  async createHomeschoolSemester(payload: CreateHomeschoolSemesterRequest): Promise<HomeschoolSemester> {
    return this.post<HomeschoolSemester, CreateHomeschoolSemesterRequest>("/homeschool/semesters", payload);
  }

  async listHomeschoolSubjects(householdId: number): Promise<HomeschoolSubject[]> {
    return this.get<HomeschoolSubject[]>("/homeschool/subjects", { household_id: householdId });
  }

  async createHomeschoolSubject(payload: CreateHomeschoolSubjectRequest): Promise<HomeschoolSubject> {
    return this.post<HomeschoolSubject, CreateHomeschoolSubjectRequest>("/homeschool/subjects", payload);
  }

  async listHomeschoolAttendance(householdId: number, childId?: number): Promise<HomeschoolAttendance[]> {
    return this.get<HomeschoolAttendance[]>("/homeschool/attendance", { household_id: householdId, child_id: childId });
  }

  async upsertHomeschoolAttendance(payload: UpsertHomeschoolAttendanceRequest): Promise<HomeschoolAttendance> {
    return this.put<HomeschoolAttendance, UpsertHomeschoolAttendanceRequest>("/homeschool/attendance", payload);
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

  async createSubmission(payload: SubmissionRequest): Promise<SubmissionResponse> {
    return this.post<SubmissionResponse, SubmissionRequest>("/submissions", payload);
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
    return this.post<SubmissionReview, SubmissionItemDecisionRequest>(
      `/submissions/${submissionId}/items/${itemId}/decision`,
      payload,
    );
  }

  private async get<TResponse>(path: string, query?: RequestQuery): Promise<TResponse> {
    return this.request<TResponse>(path, { method: "GET" }, query);
  }

  private async post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async postNoContent(path: string): Promise<void> {
    await this.request<void>(path, { method: "POST" });
  }

  private async postNoContentWithBody<TBody>(path: string, body: TBody): Promise<void> {
    await this.request<void>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async put<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async delete(path: string, query?: RequestQuery): Promise<void> {
    await this.request<void>(path, { method: "DELETE" }, query);
  }

  private async request<TResponse>(path: string, init: RequestInit, query?: RequestQuery): Promise<TResponse> {
    const csrfToken = requiresCsrfToken(init.method) ? this.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME) : null;

    const response = await this.fetchImpl(buildUrl(this.baseUrl, path, query), {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
        ...(csrfToken !== null ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
      },
      credentials: "include",
    });

    const contentType = response.headers.get("content-type");
    const noBody = response.status === 204 || response.status === 205;
    const hasJsonBody = !noBody && contentType !== null && contentType.includes("application/json");
    const data: unknown = hasJsonBody ? await response.json() : undefined;

    if (!response.ok) {
      const errorData = isApiErrorResponse(data) ? data : undefined;
      const detail = errorData?.detail ?? response.statusText ?? "Request failed";
      throw new ApiClientError(response.status, detail, data);
    }

    return data as TResponse;
  }
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  return new ApiClient(config);
}

export const apiClient = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL });

export function resolveApiBaseUrl(): string {
  const rawValue = import.meta.env.VITE_API_BASE_URL;
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  return rawValue;
}

function resolveFetchImpl(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl !== undefined) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new Error("Global fetch is not available.");
  }

  return globalThis.fetch.bind(globalThis);
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (trimmedBaseUrl.length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  if (isAbsoluteHttpUrl(trimmedBaseUrl)) {
    return trimmedBaseUrl.replace(/\/+$/, "");
  }

  if (!trimmedBaseUrl.startsWith("/")) {
    return `/${trimmedBaseUrl.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  }

  return trimmedBaseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: RequestQuery): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (isAbsoluteHttpUrl(baseUrl)) {
    const absoluteUrl = new URL(normalizedPath.replace(/^\/+/, ""), `${baseUrl}/`);
    appendQueryParams(absoluteUrl.searchParams, query);
    return absoluteUrl.toString();
  }

  const relativeUrl = `${baseUrl}${normalizedPath}`;
  if (query === undefined) {
    return relativeUrl;
  }

  const searchParams = new URLSearchParams();
  appendQueryParams(searchParams, query);
  const serialized = searchParams.toString();
  return serialized.length > 0 ? `${relativeUrl}?${serialized}` : relativeUrl;
}

function appendQueryParams(searchParams: URLSearchParams, query?: RequestQuery): void {
  if (query === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function requiresCsrfToken(method?: string): boolean {
  return method !== undefined && method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  for (const rawCookie of document.cookie.split(";")) {
    const cookie = rawCookie.trim();
    if (cookie.startsWith(prefix)) {
      const value = cookie.slice(prefix.length);
      return value.length > 0 ? decodeURIComponent(value) : "";
    }
  }

  return null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("detail" in value)) {
    return true;
  }

  return typeof value.detail === "string" || value.detail === undefined;
}
