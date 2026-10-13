import { FamilyTreeApiEndpoints } from "@family-manager/family-api/endpoints";
import {
  buildUrl,
  extractDomainError,
  extractDownloadFilename,
  extractErrorDetail,
  normalizeBaseUrl,
  requiresCsrfToken,
  type BinaryDownload,
  type RequestQuery,
  type RequestOptions,
} from "@family-manager/family-api/client-core";

export const DEFAULT_API_BASE_URL = "/chore-api";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_COOKIE_NAME = "chore_tracker_csrf";

export class ApiClientError extends Error {
  status: number;
  detail: string;
  code: string | null;
  data: unknown;

  constructor(status: number, detail: string, data: unknown) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
    this.code = extractDomainError(data)?.code ?? null;
    this.data = data;
  }
}

export type ApiClientConfig = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class ApiClient extends FamilyTreeApiEndpoints {
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private csrfToken: string | null;

  constructor(config: ApiClientConfig = {}) {
    super();
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl ?? resolveApiBaseUrl(),
      DEFAULT_API_BASE_URL,
      {
        allowRelative: true,
      },
    );
    this.fetchImpl = resolveFetchImpl(config.fetchImpl);
    this.csrfToken = readCookieValue(CSRF_COOKIE_NAME);
  }

  protected override afterAuthSession(
    session: import("./models").AuthSessionResponse,
  ): void {
    this.csrfToken =
      session.csrf_token ?? this.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME);
  }

  protected override afterLogout(): void {
    this.csrfToken = null;
  }

  protected async get<TResponse>(
    path: string,
    query?: RequestQuery,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(
      path,
      { method: "GET", signal: options?.signal },
      query,
    );
  }

  protected async post<TResponse, TBody>(
    path: string,
    body: TBody,
    query?: RequestQuery,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(
      path,
      {
        method: "POST",
        signal: options?.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      query,
    );
  }

  protected override postMultipart<TResponse>(
    path: string,
    body: FormData,
    options?: RequestOptions,
  ): Promise<TResponse> {
    // Browser/native fetch owns the multipart boundary and file representation.
    return this.request<TResponse>(
      path,
      { method: "POST", body, cache: "no-store", signal: options?.signal },
      undefined,
      "safe-json",
    );
  }

  protected override getBinary(
    path: string,
    options?: RequestOptions,
  ): Promise<BinaryDownload> {
    return this.request<BinaryDownload>(
      path,
      {
        method: "GET",
        signal: options?.signal,
        headers: { Accept: "*/*" },
        cache: "no-store",
      },
      undefined,
      "binary",
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
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PUT",
      signal: options?.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected async patch<TResponse, TBody>(
    path: string,
    body: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "PATCH",
      signal: options?.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected override deleteWithBody<TResponse, TBody>(
    path: string,
    body: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: "DELETE",
      signal: options?.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected override deleteWithResponse<TResponse>(
    path: string,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>(
      path,
      { method: "DELETE", cache: "no-store", signal: options?.signal },
      undefined,
      "safe-json",
    );
  }

  protected async delete(
    path: string,
    query?: RequestQuery,
    options?: RequestOptions,
  ): Promise<void> {
    await this.request<void>(
      path,
      { method: "DELETE", signal: options?.signal },
      query,
    );
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit,
    query?: RequestQuery,
    responseType: "json" | "safe-json" | "binary" = "json",
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
    let data: unknown;
    if (hasJsonBody && (responseType !== "binary" || !response.ok)) {
      try {
        data = await response.json();
      } catch (error) {
        // Cancellation during body consumption is not malformed server JSON.
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "AbortError"
        )
          throw error;
        // Failed file responses can be HTML/truncated JSON with private paths.
        // Never surface a decoder exception (which may embed the raw body).
        if (response.ok) {
          if (responseType === "safe-json") {
            throw new ApiClientError(
              response.status,
              "Invalid server response.",
              undefined,
            );
          }
          throw error;
        }
      }
    }

    if (!response.ok) {
      const detail = extractErrorDetail(data, response.statusText);
      throw new ApiClientError(response.status, detail, data);
    }

    if (responseType === "safe-json" && !hasJsonBody) {
      throw new ApiClientError(
        response.status,
        "Invalid server response.",
        undefined,
      );
    }

    if (responseType === "binary") {
      const download: BinaryDownload = {
        bytes: await response.arrayBuffer(),
        content_type: contentType ?? "application/octet-stream",
        filename: extractDownloadFilename(
          response.headers.get("content-disposition"),
        ),
      };
      return download as TResponse;
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
