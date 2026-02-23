import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Login page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits email/password and navigates to parent dashboard", async () => {
    const loginSpy = vi.spyOn(apiClient, "login");
    loginSpy.mockResolvedValue({
      user: {
        id: 3,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: "csrf-token",
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " parent@example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith({ email: "parent@example.com", password: "password123" }),
    );
    expect(await screen.findByRole("heading", { name: "Parent Dashboard" })).toBeVisible();
  });

  it("shows inline error when login request fails", async () => {
    const loginSpy = vi.spyOn(apiClient, "login");
    loginSpy.mockRejectedValue(
      new ApiClientError(401, "Invalid email or password.", {
        detail: "Invalid email or password.",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "parent@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not sign in: Invalid email or password.",
    );
  });

  it("shows submitting state while login request is in flight", async () => {
    let resolveLogin: (() => void) | null = null;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = () => resolve(undefined);
    });

    const loginSpy = vi.spyOn(apiClient, "login");
    loginSpy.mockImplementation(async () => {
      await loginPromise;
      return {
        user: {
          id: 8,
          household_id: 1,
          email: "parent@example.com",
          role: "PARENT",
          child_id: null,
        },
        csrf_token: "csrf-token",
      };
    });
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "parent@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("button", { name: "Signing In..." })).toBeDisabled();
    expect(screen.getByText("Signing you in...")).toBeVisible();

    resolveLogin?.();

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "Parent Dashboard" })).toBeVisible();
  });
});
