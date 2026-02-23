import { ApiClient, ApiClientError, DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "./client";

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

  it("calls pending submissions endpoint with status query", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 8,
            child_id: 1,
            child_name: "Maya",
            for_date: "2026-02-23",
            status: "PENDING",
            items: [
              {
                id: 21,
                chore_id: 12,
                chore_name: "Dishes",
                chore_reward_cents: 300,
                status: "PENDING",
              },
            ],
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const submissions = await client.listSubmissions({ status: "PENDING" });

    expect(submissions[0]?.child_name).toBe("Maya");
    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/submissions?status=PENDING",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("serializes approve-all and per-item decision submission actions", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 8,
            child_id: 1,
            child_name: "Maya",
            for_date: "2026-02-23",
            status: "APPROVED",
            items: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 8,
            child_id: 1,
            child_name: "Maya",
            for_date: "2026-02-23",
            status: "PENDING",
            items: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.approveSubmission(8);
    await client.decideSubmissionItem(8, 21, { status: "REJECTED" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/chore-api/submissions/8/approve-all",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/submissions/8/items/21/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status: "REJECTED" }),
      }),
    );
  });

  it("supports absolute API base URLs for local development backends", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, household_id: 2, name: "Maya", active: true }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ApiClient({
      baseUrl: "http://127.0.0.1:8000/chore-api",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.listChildren({ household_id: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/chore-api/children?household_id=2",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("falls back to the production API base when env configuration is missing", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    expect(resolveApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    vi.unstubAllEnvs();
  });

  it("binds global fetch to avoid illegal invocation errors", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(function (this: unknown) {
        if (this !== globalThis) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        }

        return Promise.resolve(
          new Response(JSON.stringify([{ id: 1, household_id: 2, name: "Maya", active: true }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      } as typeof fetch);

    const client = new ApiClient();
    await expect(client.listChildren({ household_id: 2 })).resolves.toEqual([
      { id: 1, household_id: 2, name: "Maya", active: true },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
