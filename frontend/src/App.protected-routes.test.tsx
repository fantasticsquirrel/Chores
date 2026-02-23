import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("shows parent navigation and allows authenticated parent navigation between parent routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 13,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Parent Dashboard" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Parent Dashboard" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Children" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Board" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Child Today" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Children" }));
    expect(await screen.findByRole("heading", { name: "Children Management" })).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "Board" }));
    expect(await screen.findByRole("heading", { name: "Submission Review" })).toBeVisible();
  });

  it("shows child navigation and keeps child users on child routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 14,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        child_id: 14,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Child Today" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Child Today" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Parent Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Children" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Board" })).not.toBeInTheDocument();
  });
});
