import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Auth bootstrap and logout", () => {
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

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Signed in as parent@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeVisible();
    expect(meSpy).toHaveBeenCalledTimes(1);
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
    const logoutSpy = vi.spyOn(apiClient, "logout");
    logoutSpy.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
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
    const logoutSpy = vi.spyOn(apiClient, "logout");
    logoutSpy.mockRejectedValue(
      new ApiClientError(500, "Service unavailable.", {
        detail: "Service unavailable.",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
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
