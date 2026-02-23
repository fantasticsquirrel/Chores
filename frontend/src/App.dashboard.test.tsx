import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders child balance rows and quick actions", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 1, household_id: 1, name: "Maya", active: true }]);
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");
    listSubmissionsSpy.mockResolvedValue([
      {
        id: 9,
        child_id: 1,
        child_name: "Maya",
        for_date: "2026-02-23",
        status: "PENDING",
        items: [],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Maya")).toBeVisible();
    expect(screen.getByText("Pending Submissions").closest("article")).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Manage Children" })).toHaveAttribute("href", "/parent/children");
    expect(screen.getByRole("link", { name: "Open Board" })).toHaveAttribute("href", "/board");
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 1 });
    expect(listSubmissionsSpy).toHaveBeenCalledWith({ status: "PENDING" });
  });

  it("shows an error message when children loading fails", async () => {
    vi.spyOn(apiClient, "listChildren").mockRejectedValue(
      new ApiClientError(503, "Backend unavailable", {
        detail: "Backend unavailable",
      }),
    );
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load children: Backend unavailable");
  });

  it("uses authenticated household scope for dashboard data loading", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 22,
        household_id: 42,
        email: "parent42@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 5, household_id: 42, name: "Ari", active: true }]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ari")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 42 });
  });
});
