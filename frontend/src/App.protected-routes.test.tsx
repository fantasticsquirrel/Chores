import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Protected routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects anonymous users to login for protected routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockRejectedValue(
      new ApiClientError(401, "Not authenticated.", { detail: "Not authenticated." }),
    );
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
    await waitFor(() => expect(listChildrenSpy).not.toHaveBeenCalled());
  });

  it("redirects child users away from parent routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 11,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        child_id: 11,
      },
      csrf_token: null,
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    const listEligibleChoresSpy = vi.spyOn(apiClient, "listEligibleChores");
    listEligibleChoresSpy.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Child Today" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Parent Dashboard" })).not.toBeInTheDocument();
    await waitFor(() => expect(listChildrenSpy).not.toHaveBeenCalled());
  });

  it("redirects parent users away from child routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 12,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([]);
    const listEligibleChoresSpy = vi.spyOn(apiClient, "listEligibleChores");

    render(
      <MemoryRouter initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Parent Dashboard" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Child Today" })).not.toBeInTheDocument();
    await waitFor(() => expect(listEligibleChoresSpy).not.toHaveBeenCalled());
  });
});
