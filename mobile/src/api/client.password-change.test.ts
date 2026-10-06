import { describe, expect, it, vi } from "vitest";

import { ApiClient, CSRF_HEADER_NAME } from "./client";

const baseUrl = "https://family.example.test/chore-api";
const passwordChange = {
  current_password: "current-test-password",
  new_password: "new-test-password-long",
};
const login = { email: "next@example.test", password: "fixture-password" };
const jsonResponse = (csrfToken: string) => new Response(
  JSON.stringify({ csrf_token: csrfToken, user: { id: 2 } }),
  { status: 200, headers: { "Content-Type": "application/json" } },
);

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((release) => { resolve = release; });
  return { promise, resolve };
}

const nextAuthOperations = [
  { name: "parent sign-in", path: "/auth/login", run: (client: ApiClient) => client.login(login), csrf: "new-csrf" },
  { name: "child sign-in", path: "/auth/child-login", run: (client: ApiClient) => client.childLogin({ parent_email: login.email, child_name: "Maya", password: login.password }), csrf: "new-csrf" },
  { name: "bootstrap", path: "/auth/me", run: (client: ApiClient) => client.getCurrentSession(), csrf: "new-csrf" },
  { name: "logout", path: "/auth/logout", run: (client: ApiClient) => client.logout(), csrf: null },
];

describe("password-change authentication ownership", () => {
  it.each(nextAuthOperations)("finishes password-change cookie deletion before a newer $name", async ({ path, run, csrf }) => {
    const pending = deferredResponse();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse("old-csrf"))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(csrf === null ? new Response(null, { status: 204 }) : jsonResponse(csrf))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login(login);
    const change = client.changePassword(passwordChange);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const next = run(client);
    await Promise.resolve();
    await Promise.resolve();
    try {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      pending.resolve(new Response(null, { status: 204 }));
      await Promise.all([change, next]);
    }
    expect(fetchMock.mock.calls[1]).toEqual([
      `${baseUrl}/auth/change-password`,
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify(passwordChange),
        headers: expect.objectContaining({ [CSRF_HEADER_NAME]: "old-csrf" }),
      }),
    ]);
    expect(fetchMock.mock.calls[2][0]).toBe(`${baseUrl}${path}`);
    await client.createRecipe({ title: "QA" });
    const headers = fetchMock.mock.calls[3][1]?.headers;
    if (csrf === null) expect(headers).not.toHaveProperty(CSRF_HEADER_NAME);
    else expect(headers).toHaveProperty(CSRF_HEADER_NAME, csrf);
  });

  it("drops the revoked actor's CSRF after a matching password-change success", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse("old-csrf"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login(login);
    await client.changePassword(passwordChange);
    await client.createRecipe({ title: "QA" });
    expect(fetchMock.mock.calls[2][1]?.headers).not.toHaveProperty(CSRF_HEADER_NAME);
  });

  it("retains the actor's CSRF if the password change fails", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse("old-csrf"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Current password is incorrect." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login(login);
    await expect(client.changePassword(passwordChange)).rejects.toThrow("Current password is incorrect.");
    await client.createRecipe({ title: "QA" });
    expect(fetchMock.mock.calls[2][1]?.headers).toHaveProperty(CSRF_HEADER_NAME, "old-csrf");
  });

  it("does not send a queued password change for a newly established actor", async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse("old-csrf"))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.login(login);
    const next = client.login(login);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const change = client.changePassword(passwordChange);
    const rejected = expect(change).rejects.toThrow("Authentication request was cancelled.");
    pending.resolve(jsonResponse("new-csrf"));
    await next;
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await client.createRecipe({ title: "QA" });
    expect(fetchMock.mock.calls[2][1]?.headers).toHaveProperty(CSRF_HEADER_NAME, "new-csrf");
  });
});
