import type {
  ApiErrorResponse,
  AuthSessionResponse,
  Child,
  EligibleChore,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
  ListChildrenParams,
  ListEligibleChoresParams,
  ListSubmissionsParams,
  LoginRequest,
  MyModulesResponse,
  SubmissionItemDecisionRequest,
  SubmissionRequest,
  SubmissionResponse,
  SubmissionReview,
} from "./models";

export const DEFAULT_API_BASE_URL = "http://10.0.2.2:8000/chore-api";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

type QueryValue = string | number | boolean | null | undefined;
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
  private csrfToken: string | null;
  private fetchImpl: typeof fetch;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? resolveApiBaseUrl());
    this.fetchImpl = resolveFetchImpl(config.fetchImpl);
    this.csrfToken = null;
  }

  get apiBaseUrl(): string {
    return this.baseUrl;
  }

  async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    const session = await this.post<AuthSessionResponse, LoginRequest>(
      "/auth/login",
      payload,
    );
    this.csrfToken = session.csrf_token ?? null;
    return session;
  }

  async getCurrentSession(): Promise<AuthSessionResponse> {
    const session = await this.get<AuthSessionResponse>("/auth/me");
    this.csrfToken = session.csrf_token ?? this.csrfToken;
    return session;
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" });
    this.csrfToken = null;
  }

  async getMyModules(): Promise<MyModulesResponse> {
    return this.get<MyModulesResponse>("/modules/me");
  }

  async listChildren(params: ListChildrenParams): Promise<Child[]> {
    return this.get<Child[]>("/children", {
      household_id: params.household_id,
      active_only: params.active_only,
    });
  }

  async listEligibleChores(
    params: ListEligibleChoresParams,
  ): Promise<EligibleChore[]> {
    return this.get<EligibleChore[]>("/children/me/eligible-chores", {
      date: params.date,
      child_id: params.child_id,
    });
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
    return this.get<SubmissionReview[]>("/submissions", {
      status: params.status,
    });
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

  async listHomeschoolSemesters(
    householdId: number,
  ): Promise<HomeschoolSemester[]> {
    return this.get<HomeschoolSemester[]>("/homeschool/semesters", {
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

  async listHomeschoolAttendance(
    householdId: number,
    childId?: number,
  ): Promise<HomeschoolAttendance[]> {
    return this.get<HomeschoolAttendance[]>("/homeschool/attendance", {
      household_id: householdId,
      child_id: childId,
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

  async listHomeschoolGrades(
    householdId: number,
    childId?: number,
  ): Promise<HomeschoolGrade[]> {
    return this.get<HomeschoolGrade[]>("/homeschool/grades", {
      household_id: householdId,
      child_id: childId,
    });
  }

  private async get<TResponse>(
    path: string,
    query?: RequestQuery,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { method: "GET" }, query);
  }

  private async post<TResponse, TBody>(
    path: string,
    body: TBody,
    query?: RequestQuery,
  ): Promise<TResponse> {
    return this.request<TResponse>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      query,
    );
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit,
    query?: RequestQuery,
  ): Promise<TResponse> {
    const csrfToken = requiresCsrfToken(init.method) ? this.csrfToken : null;
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
    const hasJsonBody =
      !noBody &&
      contentType !== null &&
      contentType.includes("application/json");
    const data: unknown = hasJsonBody ? await response.json() : undefined;

    if (!response.ok) {
      const detail = extractErrorDetail(data, response.statusText);
      throw new ApiClientError(response.status, detail, data);
    }

    return data as TResponse;
  }
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  return new ApiClient(config);
}

export const apiClient = createApiClient();

export function resolveApiBaseUrl(): string {
  const rawValue = process.env.EXPO_PUBLIC_API_BASE_URL;
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
  return trimmedBaseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: RequestQuery): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = new URL(normalizedPath.replace(/^\/+/, ""), `${baseUrl}/`);
  appendQueryParams(absoluteUrl.searchParams, query);
  return absoluteUrl.toString();
}

function appendQueryParams(
  searchParams: URLSearchParams,
  query?: RequestQuery,
): void {
  if (query === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
}

function requiresCsrfToken(method?: string): boolean {
  return (
    method !== undefined &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS"
  );
}

function extractErrorDetail(data: unknown, fallback: string): string {
  if (!isApiErrorResponse(data)) {
    return fallback || "Request failed";
  }

  const { detail } = data;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map(formatValidationDetail)
      .filter((message) => message.length > 0);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }
  return fallback || "Request failed";
}

function formatValidationDetail(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || value === null) {
    return "";
  }
  const record = value as Record<string, unknown>;
  const message = typeof record.msg === "string" ? record.msg : "";
  const location = Array.isArray(record.loc)
    ? record.loc
        .filter((part) => typeof part === "string" || typeof part === "number")
        .join(".")
    : "";
  if (message.length === 0) {
    return "";
  }
  return location.length > 0 ? `${location}: ${message}` : message;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return typeof value === "object" && value !== null && "detail" in value;
}
