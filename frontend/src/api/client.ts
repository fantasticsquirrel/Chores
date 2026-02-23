import type {
  ApiErrorResponse,
  Child,
  CreateChildRequest,
  EligibleChore,
  HealthResponse,
  ListEligibleChoresParams,
  ListSubmissionsParams,
  ListChildrenParams,
  ReadinessResponse,
  SubmissionItemDecisionRequest,
  SubmissionReview,
  SubmissionRequest,
  SubmissionResponse,
  UpdateChildRequest,
} from "./models";

const DEFAULT_API_BASE_URL = "/chore-api";

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

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_API_BASE_URL);
    this.fetchImpl = config.fetchImpl ?? fetch;
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

  async listChildren(params: ListChildrenParams): Promise<Child[]> {
    return this.get<Child[]>("/children", params);
  }

  async createChild(payload: CreateChildRequest): Promise<Child> {
    return this.post<Child, CreateChildRequest>("/children", payload);
  }

  async updateChild(childId: number, payload: UpdateChildRequest): Promise<Child> {
    return this.patch<Child, UpdateChildRequest>(`/children/${childId}`, payload);
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

  private async patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async request<TResponse>(path: string, init: RequestInit, query?: RequestQuery): Promise<TResponse> {
    const response = await this.fetchImpl(buildUrl(this.baseUrl, path, query), {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
      credentials: "include",
    });

    const contentType = response.headers.get("content-type");
    const hasJsonBody = contentType !== null && contentType.includes("application/json");
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

export const apiClient = createApiClient();

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl.startsWith("/")) {
    return `/${baseUrl.replace(/\/+$/, "")}`;
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: RequestQuery): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  if (query === undefined) {
    return url;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const serialized = searchParams.toString();
  return serialized.length > 0 ? `${url}?${serialized}` : url;
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
