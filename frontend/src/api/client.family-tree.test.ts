// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, CSRF_HEADER_NAME } from "./client";
import { FamilyRecipeApiEndpoints } from "@family-manager/family-api/endpoints";

class DeleteClient extends ApiClient {
  remove<T>(body: unknown): Promise<T> {
    return this.deleteWithBody<T, unknown>("/transport-test/delete", body);
  }
}
const baseUrl = "https://family.example.test/chore-api";
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const result = {
  committed_revision: 4,
  current_revision: 4,
  replayed: false,
  affected: {
    person_ids: [],
    relationship_ids: [7],
    story_ids: [],
    residence_ids: [],
    identity_link_ids: [],
    media_asset_ids: [],
    media_reference_ids: [],
  },
  warnings: [],
};

describe("Family Tree real client inheritance and DELETE bodies", () => {
  afterEach(() => {
    document.cookie = "chore_tracker_csrf=; Max-Age=0; path=/";
  });
  it("uses the browser CSRF cookie for JSON DELETE without moving body fields to query", async () => {
    document.cookie = "chore_tracker_csrf=cookie%20csrf; path=/";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(result));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.unlinkFamilyTreeIdentity(7, { expected_graph_revision: 3 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("?");
    expect(JSON.parse(init?.body as string)).toEqual({
      expected_graph_revision: 3,
    });
    expect(new Headers(init?.headers).get(CSRF_HEADER_NAME)).toBe(
      "cookie csrf",
    );
  });
  it("inherits callable tree and prior recipe methods", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(result));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    expect(client).toBeInstanceOf(FamilyRecipeApiEndpoints);
    expect(typeof client.listRecipes).toBe("function");
    await expect(
      client.deleteFamilyTreeParentLink(7, { expected_graph_revision: 3 }),
    ).resolves.toEqual(result);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${baseUrl}/family-tree/parent-links/7`,
    );
  });
  it("sends JSON DELETE revision/warning bodies with cookies and session CSRF, returning JSON", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ csrf_token: "session-csrf" }))
      .mockResolvedValueOnce(json(result));
    const client = new DeleteClient({ baseUrl, fetchImpl: fetchMock });
    await client.login({
      email: "parent@example.com",
      password: "test-password",
    });
    const body = {
      expected_graph_revision: 3,
      reviewed_warnings: ["chronology_review"],
      idempotency_key: "delete-7",
    };
    await expect(client.remove<typeof result>(body)).resolves.toEqual(result);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`${baseUrl}/transport-test/delete`);
    expect(init).toMatchObject({ method: "DELETE", credentials: "include" });
    expect(JSON.parse(init?.body as string)).toEqual(body);
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get(CSRF_HEADER_NAME)).toBe("session-csrf");
  });
  it("preserves explicit PATCH null but never fills omitted fields", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(result));
    const client = new ApiClient({ baseUrl, fetchImpl: fetchMock });
    await client.patchFamilyTreePerson(7, {
      expected_graph_revision: 3,
      changes: { death_place: null, display_name: "Ada" },
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PATCH");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      expected_graph_revision: 3,
      changes: { death_place: null, display_name: "Ada" },
    });
    expect(body.changes).not.toHaveProperty("aliases");
    expect(body.changes).not.toHaveProperty("birth_date");
  });
  it("preserves DELETE error envelopes and sends no guessed CSRF when unauthenticated", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json(
          {
            detail: {
              code: "revision_conflict",
              message: "Refresh",
              warnings: [],
            },
          },
          409,
        ),
      );
    const client = new DeleteClient({ baseUrl, fetchImpl: fetchMock });
    await expect(
      client.remove({ expected_graph_revision: 3 }),
    ).rejects.toMatchObject({
      status: 409,
      code: "revision_conflict",
      detail: "Refresh",
    });
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has(CSRF_HEADER_NAME),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
