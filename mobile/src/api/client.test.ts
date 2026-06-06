import { describe, expect, it, vi } from "vitest";

import { ApiClient, CSRF_HEADER_NAME } from "./client";

describe("mobile ApiClient", () => {
  it("builds absolute API URLs with typed query params", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 1, household_id: 2, name: "Maya", active: true },
        ]),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );

    const client = new ApiClient({
      baseUrl: "https://family.example.test/chore-api/",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.listChildren({ household_id: 2, active_only: true }),
    ).resolves.toEqual([
      { id: 1, household_id: 2, name: "Maya", active: true },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://family.example.test/chore-api/children?household_id=2&active_only=true",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
  });

  it("sends CSRF headers on authenticated write requests", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            csrf_token: "csrf-token",
            user: {
              child_id: null,
              email: "parent@example.com",
              household_id: 7,
              id: 12,
              role: "PARENT",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            active: true,
            household_id: 7,
            id: 20,
            name: "Avery",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 201,
          },
        ),
      );

    const client = new ApiClient({
      baseUrl: "https://family.example.test/chore-api",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await client.login({
      email: "parent@example.com",
      password: "password123",
    });
    await client.createChild({
      active: true,
      household_id: 7,
      name: "Avery",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://family.example.test/chore-api/children",
      expect.objectContaining({
        body: JSON.stringify({
          active: true,
          household_id: 7,
          name: "Avery",
        }),
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: "csrf-token",
        }),
        method: "POST",
      }),
    );
  });
});
