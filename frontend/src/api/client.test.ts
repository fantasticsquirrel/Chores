import { ApiClient, ApiClientError } from "./client";

describe("ApiClient", () => {
  it("calls /chore-api children list endpoint with typed query params", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, household_id: 2, name: "Maya", active: true }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const children = await client.listChildren({ household_id: 2, active_only: true });

    expect(children).toEqual([{ id: 1, household_id: 2, name: "Maya", active: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/children?household_id=2&active_only=true",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("serializes typed create child payload for POST requests", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 3, household_id: 9, name: "Leo", active: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.createChild({ household_id: 9, name: "Leo", active: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/children",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ household_id: 9, name: "Leo", active: true }),
      }),
    );
  });

  it("throws ApiClientError with backend detail on non-2xx responses", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Child not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.updateChild(11, { household_id: 2, active: false })).rejects.toMatchObject<ApiClientError>({
      name: "ApiClientError",
      status: 404,
      detail: "Child not found.",
    });
  });

  it("calls eligible chores endpoint with date query param", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ chore_id: 12, name: "Dishes", reward_cents: 300, occurrence_date: "2026-02-23" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const chores = await client.listEligibleChores({ date: "2026-02-23" });

    expect(chores).toEqual([{ chore_id: 12, name: "Dishes", reward_cents: 300, occurrence_date: "2026-02-23" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/children/me/eligible-chores?date=2026-02-23",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("serializes submission payload for submit requests", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 5,
          child_id: 9,
          for_date: "2026-02-23",
          status: "PENDING",
          items: [{ chore_id: 12, status: "PENDING" }],
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.createSubmission({ for_date: "2026-02-23", chore_ids: [12] });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/submissions",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ for_date: "2026-02-23", chore_ids: [12] }),
      }),
    );
  });
});
