export type RequestQueryValue = string | number | boolean | null | undefined;
export type RequestQuery = object;

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

  for (const [key, value] of Object.entries(query as Record<string, RequestQueryValue>)) {
    if (value !== undefined && value !== null) {
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

export function extractErrorDetail(data: unknown, fallback: string): string {
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
