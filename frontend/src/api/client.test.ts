import { ApiClient, ApiClientError, CSRF_HEADER_NAME, DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "./client";

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

  it("serializes login payload for auth endpoint", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 11,
            household_id: 2,
            email: "parent@example.com",
            role: "PARENT",
            child_id: null,
          },
          csrf_token: "csrf-token",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.login({ email: "parent@example.com", password: "password123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ email: "parent@example.com", password: "password123" }),
      }),
    );
  });

  it("loads current session from /auth/me", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 11,
            household_id: 2,
            email: "parent@example.com",
            role: "PARENT",
            child_id: null,
          },
          csrf_token: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.getCurrentSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "/chore-api/auth/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });

  it("sends CSRF header on logout after login", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 11,
              household_id: 2,
              email: "parent@example.com",
              role: "PARENT",
              child_id: null,
            },
            csrf_token: "csrf-token",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.login({ email: "parent@example.com", password: "password123" });
    await client.logout();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          [CSRF_HEADER_NAME]: "csrf-token",
        }),
      }),
    );
  });

  it("serializes change-password payload with CSRF header", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 11,
              household_id: 2,
              email: "parent@example.com",
              role: "PARENT",
              child_id: null,
            },
            csrf_token: "csrf-token",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.login({ email: "parent@example.com", password: "password123" });
    await client.changePassword({
      current_password: "password123",
      new_password: "new-password-456",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/auth/change-password",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: "csrf-token",
        }),
        body: JSON.stringify({
          current_password: "password123",
          new_password: "new-password-456",
        }),
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

  it("serializes family module access endpoints", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ modules: [{ key: "chores", name: "Chores", description: "" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 2, household_id: 1, email: "parent@example.com", role: "PARENT", child_id: null, modules: [] }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2, household_id: 1, email: "parent@example.com", role: "PARENT", child_id: null, modules: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.getMyModules();
    await client.listUserModuleAccess();
    await client.setUserModuleAccess(2, { module_key: "homeschool", can_view: true, can_manage: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/chore-api/modules/me",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/modules/users",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/chore-api/modules/users/2",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ module_key: "homeschool", can_view: true, can_manage: false }),
      }),
    );
  });

  it("serializes homeschool list endpoints with household and optional child scope", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.listHomeschoolSemesters(7);
    await client.listHomeschoolSubjects(7);
    await client.listHomeschoolAttendance(7, 3);
    await client.listHomeschoolDayComments(7, 3);
    await client.listHomeschoolGrades(7, 3);
    await client.deleteHomeschoolAttendance(9, 7);
    await client.deleteHomeschoolDayComment(10, 7);
    await client.deleteHomeschoolGrade(11, 7);
    await client.deleteHomeschoolSemester(12, 7);
    await client.deleteHomeschoolSubject(13, 7);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/chore-api/homeschool/semesters?household_id=7",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/homeschool/subjects?household_id=7",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/chore-api/homeschool/attendance?household_id=7&child_id=3",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/chore-api/homeschool/day-comments?household_id=7&child_id=3",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/chore-api/homeschool/grades?household_id=7&child_id=3",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/chore-api/homeschool/attendance/9?household_id=7",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "/chore-api/homeschool/day-comments/10?household_id=7",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "/chore-api/homeschool/grades/11?household_id=7",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "/chore-api/homeschool/semesters/12?household_id=7",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      "/chore-api/homeschool/subjects/13?household_id=7",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("serializes homeschool create and upsert payloads", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, household_id: 7, name: "Fall", start_date: "2026-08-15", end_date: "2026-12-20", active: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2, household_id: 7, name: "Math", color: "#3b82f6", active: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, household_id: 7, name: "Spring", start_date: "2027-01-10", end_date: "2027-05-20", active: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2, household_id: 7, name: "Reading", color: "#f97316", active: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 3, household_id: 7, child_id: 4, subject_id: 2, date: "2026-09-01", present: true, comment: "Fractions" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 4, household_id: 7, child_id: 4, date: "2026-09-01", comment: "Good focus" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 5, household_id: 7, child_id: 4, subject_id: 2, semester_id: 1, grade: "A" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new ApiClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.createHomeschoolSemester({ household_id: 7, name: "Fall", start_date: "2026-08-15", end_date: "2026-12-20" });
    await client.createHomeschoolSubject({ household_id: 7, name: "Math", color: "#3b82f6" });
    await client.updateHomeschoolSemester(1, { household_id: 7, name: "Spring", start_date: "2027-01-10", end_date: "2027-05-20" });
    await client.updateHomeschoolSubject(2, { household_id: 7, name: "Reading", color: "#f97316" });
    await client.upsertHomeschoolAttendance({ household_id: 7, child_id: 4, subject_id: 2, date: "2026-09-01", present: true, comment: "Fractions" });
    await client.upsertHomeschoolDayComment({ household_id: 7, child_id: 4, date: "2026-09-01", comment: "Good focus" });
    await client.upsertHomeschoolGrade({ household_id: 7, child_id: 4, subject_id: 2, semester_id: 1, grade: "A" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/chore-api/homeschool/semesters",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ household_id: 7, name: "Fall", start_date: "2026-08-15", end_date: "2026-12-20" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/chore-api/homeschool/subjects",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ household_id: 7, name: "Math", color: "#3b82f6" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/chore-api/homeschool/semesters/1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ household_id: 7, name: "Spring", start_date: "2027-01-10", end_date: "2027-05-20" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/chore-api/homeschool/subjects/2",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ household_id: 7, name: "Reading", color: "#f97316" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/chore-api/homeschool/attendance",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ household_id: 7, child_id: 4, subject_id: 2, date: "2026-09-01", present: true, comment: "Fractions" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/chore-api/homeschool/day-comments",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ household_id: 7, child_id: 4, date: "2026-09-01", comment: "Good focus" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "/chore-api/homeschool/grades",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ household_id: 7, child_id: 4, subject_id: 2, semester_id: 1, grade: "A" }) }),
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
