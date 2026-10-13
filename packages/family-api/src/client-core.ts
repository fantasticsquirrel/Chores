import type { AuthSessionResponse } from "./models/auth";

export type RequestQueryScalar = string | number | boolean;
export type RequestQueryValue =
  | RequestQueryScalar
  | readonly RequestQueryScalar[]
  | null
  | undefined;
export type RequestQuery = object;

export type BinaryDownload = {
  bytes: ArrayBuffer;
  content_type: string;
  filename: string | null;
};

// Field-error shapes belong to the endpoint contract, not transport mechanics.
export type DomainErrorDetail = {
  code: string;
  message: string;
  field_errors?: unknown;
};

export abstract class FamilyApiClientCore {
  protected abstract get<TResponse>(
    path: string,
    query?: RequestQuery,
  ): Promise<TResponse>;
  protected abstract post<TResponse, TBody>(
    path: string,
    body: TBody,
    query?: RequestQuery,
  ): Promise<TResponse>;
  protected abstract put<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse>;
  protected abstract patch<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Promise<TResponse>;
  protected abstract delete(path: string, query?: RequestQuery): Promise<void>;

  // JSON-only subclasses remain compatible, but cannot silently drop a body.
  protected deleteWithBody<TResponse, TBody>(
    _path: string,
    _body: TBody,
  ): Promise<TResponse> {
    return Promise.reject(new Error("JSON DELETE transport is not supported."));
  }
  protected abstract postNoContent(path: string): Promise<void>;
  protected abstract postNoContentWithBody<TBody>(
    path: string,
    body: TBody,
  ): Promise<void>;

  // Keep JSON-only consumers source-compatible while failing closed if used.
  protected postMultipart<TResponse>(
    _path: string,
    _body: FormData,
  ): Promise<TResponse> {
    return Promise.reject(new Error("Multipart transport is not supported."));
  }

  protected getBinary(_path: string): Promise<BinaryDownload> {
    return Promise.reject(new Error("Binary transport is not supported."));
  }

  protected afterAuthSession(_session: AuthSessionResponse): void {}
  protected afterLogout(): void {}
}

export type NormalizeBaseUrlOptions = {
  allowRelative: boolean;
};

export function normalizeBaseUrl(
  baseUrl: string | undefined,
  fallbackBaseUrl: string,
  options: NormalizeBaseUrlOptions,
): string {
  const trimmedBaseUrl = (baseUrl ?? "").trim();
  const value = trimmedBaseUrl.length === 0 ? fallbackBaseUrl : trimmedBaseUrl;

  if (options.allowRelative && !isAbsoluteHttpUrl(value)) {
    return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  }

  return value.replace(/\/+$/, "");
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestQuery,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (isAbsoluteHttpUrl(baseUrl)) {
    const absoluteUrl = new URL(
      normalizedPath.replace(/^\/+/, ""),
      `${baseUrl.replace(/\/+$/, "")}/`,
    );
    appendQueryParams(absoluteUrl.searchParams, query);
    return absoluteUrl.toString();
  }

  const relativeUrl = `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;
  if (query === undefined) {
    return relativeUrl;
  }

  const searchParams = new URLSearchParams();
  appendQueryParams(searchParams, query);
  const serialized = searchParams.toString();
  return serialized.length > 0 ? `${relativeUrl}?${serialized}` : relativeUrl;
}

export function appendQueryParams(
  searchParams: URLSearchParams,
  query?: RequestQuery,
): void {
  if (query === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(
    query as Record<string, RequestQueryValue>,
  )) {
    if (Array.isArray(value)) {
      searchParams.delete(key);
      for (const item of value) searchParams.append(key, String(item));
    } else if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
}

export function requiresCsrfToken(method?: string): boolean {
  return (
    method !== undefined &&
    method.toUpperCase() !== "GET" &&
    method.toUpperCase() !== "HEAD" &&
    method.toUpperCase() !== "OPTIONS"
  );
}

export function extractDomainError(data: unknown): DomainErrorDetail | null {
  if (
    !isApiErrorResponse(data) ||
    typeof data.detail !== "object" ||
    data.detail === null
  ) {
    return null;
  }
  const detail = data.detail as Record<string, unknown>;
  if (
    typeof detail.code !== "string" ||
    detail.code.trim().length === 0 ||
    typeof detail.message !== "string" ||
    detail.message.trim().length === 0
  ) {
    return null;
  }
  return {
    code: detail.code,
    message: detail.message,
    ...("field_errors" in detail ? { field_errors: detail.field_errors } : {}),
  };
}

// Presentation metadata only: never return filesystem paths or control characters.
export function extractDownloadFilename(
  contentDisposition: string | null,
): string | null {
  if (contentDisposition === null) return null;
  const extended = /(?:^|;)\s*filename\*\s*=\s*([^;]*)/i.exec(
    contentDisposition,
  );
  let filename: string;
  if (extended !== null) {
    const encoded = /^UTF-8'[^']*'(.*)$/i.exec(extended[1].trim());
    if (encoded === null) return null;
    try {
      filename = decodeURIComponent(encoded[1]);
    } catch {
      return null;
    }
  } else {
    const plain = /(?:^|;)\s*filename\s*=\s*(?:"([^"\r\n]*)"|([^;\s]+))/i.exec(
      contentDisposition,
    );
    if (plain === null) return null;
    filename = plain[1] ?? plain[2];
  }
  if (
    filename.trim().length === 0 ||
    filename === "." ||
    filename === ".." ||
    /[\/\\\u0000-\u001f\u007f]/.test(filename)
  ) {
    return null;
  }
  return filename;
}

export function extractErrorDetail(data: unknown, fallback: string): string {
  const domainError = extractDomainError(data);
  if (domainError !== null) return domainError.message;
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

function isApiErrorResponse(value: unknown): value is { detail: unknown } {
  return typeof value === "object" && value !== null && "detail" in value;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
