import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Auth bootstrap and logout", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listChildBalances").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bootstraps auth state from /auth/me on app load", async () => {
    const meSpy = vi.spyOn(apiClient, "getCurrentSession");
    meSpy.mockResolvedValue({
      user: {
        id: 3,
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Signed in as parent@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeVisible();
    expect(meSpy).toHaveBeenCalledTimes(1);
  });

  it("redirects an authenticated parent from the site root to their dashboard", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 3,
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).not.toBeInTheDocument();
  });

  it("redirects an authenticated parent away from the login route", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 3,
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).not.toBeInTheDocument();
  });

  it("redirects an authenticated child away from the login route", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 7,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        child_id: 4,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Child Today" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).not.toBeInTheDocument();
  });

  it("redirects an authenticated child from the site root to child today", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 7,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        child_id: 4,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Child Today" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).not.toBeInTheDocument();
  });

  it("renders the login route for an anonymous user", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockRejectedValue(
      new ApiClientError(401, "Not authenticated.", {
        detail: "Not authenticated.",
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
  });

  it("does not flash the login page while root session bootstrap is pending", () => {
    vi.spyOn(apiClient, "getCurrentSession").mockReturnValue(new Promise<never>(() => undefined));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Checking Session" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).not.toBeInTheDocument();
  });

  it("logs out through API and returns to the login page", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 4,
        household_id: 1,
        email: "admin@example.com",
        role: "PARENT_ADMIN",
        child_id: null,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
    const logoutSpy = vi.spyOn(apiClient, "logout");
    logoutSpy.mockResolvedValue(undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log Out" }));

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
  });

  it("shows logout error and keeps session when logout fails", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 5,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
    const logoutSpy = vi.spyOn(apiClient, "logout");
    logoutSpy.mockRejectedValue(
      new ApiClientError(500, "Service unavailable.", {
        detail: "Service unavailable.",
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log Out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out: Service unavailable.");
    expect(screen.getByText("Signed in as parent@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeVisible();
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});
