import { FamilyRecipeApiEndpoints } from "@family-manager/family-api/endpoints";
import {
  buildUrl,
  extractErrorDetail,
  normalizeBaseUrl,
  requiresCsrfToken,
  type RequestQuery,
} from "@family-manager/family-api/client-core";

export const DEFAULT_API_BASE_URL = "http://10.0.2.2:8000/chore-api";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

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
  private csrfToken: string | null;
  private fetchImpl: typeof fetch;

  constructor(config: ApiClientConfig = {}) {
    super();
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl ?? resolveApiBaseUrl(),
      DEFAULT_API_BASE_URL,
      {
        allowRelative: false,
      },
    );
    this.fetchImpl = resolveFetchImpl(config.fetchImpl);
    this.csrfToken = null;
  }

  private authQueue: Promise<void> = Promise.resolve();
  private authEpoch = 0;
  private activeAuthEpoch: number | null = null;
  private authGeneration = 0;
  private authListeners = new Set<() => void>();

  private advanceAuthentication(): void {
    this.authGeneration += 1;
    this.authListeners.forEach((listener) => listener());
  }

  subscribeAuthentication(listener: () => void): () => void {
    this.authListeners.add(listener);
    return () => { this.authListeners.delete(listener); };
  }

  // Cookie mutations cannot overtake this operation. Auth invalidates immediately
  // on enqueue, so even same-user relogin cancels obsolete publication.
  withAuthentication<T>(generation: number, operation: () => Promise<T>, current: () => boolean = () => true): Promise<T> {
    return this.enqueueAuth(async () => {
      const check = () => {
        if (generation !== this.authGeneration || !current()) throw new Error("Authentication request was cancelled.");
      };
      check();
      const result = await operation();
      check();
      return result;
    }, false);
  }

  private enqueueAuth<T>(operation: () => Promise<T>, replacesSession = true): Promise<T> {
    if (replacesSession) this.advanceAuthentication();
    const epoch = this.authEpoch;
    const run = async (): Promise<T> => {
      if (epoch !== this.authEpoch) throw new Error("Authentication request was cancelled.");
      this.activeAuthEpoch = epoch;
      try { return await operation(); } finally { this.activeAuthEpoch = null; }
    };
    const result = this.authQueue.then(run, run);
    this.authQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  override login(payload: Parameters<FamilyRecipeApiEndpoints["login"]>[0]) {
    return this.enqueueAuth(() => super.login(payload));
  }

  override childLogin(payload: Parameters<FamilyRecipeApiEndpoints["childLogin"]>[0]) {
    return this.enqueueAuth(() => super.childLogin(payload));
  }

  override getCurrentSession() {
    return this.enqueueAuth(() => super.getCurrentSession());
  }

  override logout() {
    return this.enqueueAuth(() => super.logout());
  }

  override changePassword(payload: Parameters<FamilyRecipeApiEndpoints["changePassword"]>[0]) {
    const generation = this.authGeneration;
    return this.enqueueAuth(async () => {
      // A queued form must not change credentials for a replacement actor.
      if (generation !== this.authGeneration) throw new Error("Authentication request was cancelled.");
      await super.changePassword(payload);
      // The server deleted both cookies; clear CSRF before the next auth operation.
      this.csrfToken = null;
    }, false);
  }

  get authenticationGeneration(): number {
    return this.authGeneration;
  }

  clearAuthentication(): void {
    this.authEpoch += 1;
    this.advanceAuthentication();
    this.csrfToken = null;
  }

  get apiBaseUrl(): string {
    return this.baseUrl;
  }

  protected override afterAuthSession(
    session: import("./models").AuthSessionResponse,
  ): void {
    if (this.activeAuthEpoch === this.authEpoch) {
      this.advanceAuthentication();
      this.csrfToken = session.csrf_token ?? this.csrfToken;
    }
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
