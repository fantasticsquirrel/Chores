import { OpsApiEndpoints } from "@family-manager/family-api/ops-endpoints";
import { buildUrl, extractErrorDetail, normalizeBaseUrl, requiresCsrfToken, type RequestQuery } from "@family-manager/family-api/client-core";

class OpsApiClient extends OpsApiEndpoints {
  private readonly baseUrl = normalizeBaseUrl(import.meta.env.VITE_OPS_API_BASE_URL, "/ops-api", { allowRelative: true });
  private readonly fetchImpl = globalThis.fetch.bind(globalThis);
  private csrfToken: string | null = null;

  protected async get<T>(path: string, query?: RequestQuery): Promise<T> { return this.request(path, { method: "GET" }, query); }
  protected async post<T, B>(path: string, body: B): Promise<T> {
    const response = await this.request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (path.startsWith("/auth/") && response && typeof response === "object" && "csrf_token" in response) {
      this.csrfToken = (response as { csrf_token?: string | null }).csrf_token ?? this.csrfToken;
    }
    return response;
  }
  protected async postNoContent(path: string): Promise<void> { await this.request(path, { method: "POST" }); if (path === "/auth/logout") this.csrfToken = null; }

  private async request<T>(path: string, init: RequestInit, query?: RequestQuery): Promise<T> {
    const response = await this.fetchImpl(buildUrl(this.baseUrl, path, query), {
      ...init,
      credentials: "include",
      headers: { Accept: "application/json", ...init.headers, ...(requiresCsrfToken(init.method) && this.csrfToken ? { "X-CSRF-Token": this.csrfToken } : {}) },
    });
    const json = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(extractErrorDetail(json, response.statusText));
    return json as T;
  }
}

export const opsApi = new OpsApiClient();
