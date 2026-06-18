import { FamilyRecipeApiEndpoints } from "@family-manager/family-api/api-endpoints";
import {
  buildUrl,
  extractErrorDetail,
  normalizeBaseUrl,
  requiresCsrfToken,
  type RequestQuery,
} from "@family-manager/family-api/client-core";

export const DEFAULT_API_BASE_URL = "/chore-api";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_COOKIE_NAME = "chore_tracker_csrf";

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

export class ApiClient extends FamilyRecipeApiEndpoints {
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private csrfToken: string | null;

  constructor(config: ApiClientConfig = {}) {
    super();
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? resolveApiBaseUrl(), DEFAULT_API_BASE_URL, {
      allowRelative: true,
    });
    this.fetchImpl = resolveFetchImpl(config.fetchImpl);
    this.csrfToken = readCookieValue(CSRF_COOKIE_NAME);
  }

  protected override afterAuthSession(session: import("./models").AuthSessionResponse): void {
    this.csrfToken = session.csrf_token ?? this.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME);
  }

  protected override afterLogout(): void {
    this.csrfToken = null;
  }

  protected async get<TResponse>(
    path: string,
    query?: RequestQuery,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { method: "GET" }, query);
  }

  protected async post<TResponse, TBody>(
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

  protected async postNoContent(path: string): Promise<void> {
    await this.request<void>(path, { method: "POST" });
  }

  protected async postNoContentWithBody<TBody>(
    path: string,
    body: TBody,
  ): Promise<void> {
    await this.request<void>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected async put<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected async patch<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected async delete(path: string, query?: RequestQuery): Promise<void> {
    await this.request<void>(path, { method: "DELETE" }, query);
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit,
    query?: RequestQuery,
  ): Promise<TResponse> {
    const csrfToken = requiresCsrfToken(init.method)
      ? (this.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME))
      : null;

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

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
});

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
