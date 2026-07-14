import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a task-first Today queue without finance or reports concepts", async () => {
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
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([
      { chore_id: 4, name: "Unload dishwasher", reward_cents: 0, occurrence_date: "2026-02-23", expires_on: null },
    ]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(await screen.findByText("Maya · 1 chore due")).toBeVisible();
    expect(screen.getByRole("link", { name: "Review 1 submission" })).toHaveAttribute("href", "/board");
    expect(screen.getByText("Pending Submissions").closest("article")).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Manage Children" })).toHaveAttribute("href", "/parent/children");
    expect(screen.getByRole("link", { name: "Open Board" })).toHaveAttribute("href", "/board");
    expect(screen.queryByText(/balance/iu)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /reports/iu })).not.toBeInTheDocument();
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
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
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
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Ari · 0 chores due/u)).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 42 });
  });
});
