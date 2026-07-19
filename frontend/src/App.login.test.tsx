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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Login Email"), {
      target: { value: " parent@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith({
        email: "parent@example.com",
        password: "password123",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Today" }),
    ).toBeVisible();
  });

  it("submits parent email, child name, and child password then navigates to child today", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockReturnValue(
      new Promise<never>(() => undefined),
    );
    const loginSpy = vi.spyOn(apiClient, "login");
    const childLoginSpy = vi.spyOn(apiClient, "childLogin");
    childLoginSpy.mockResolvedValue({
      user: {
        id: 7,
        household_id: 1,
        email: "generated-jordan@example.com",
        role: "CHILD",
        child_id: 4,
      },
      csrf_token: "child-csrf-token",
    });
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Child" }));
    expect(screen.getByPlaceholderText("Enter child name")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Parent Login Email"), {
      target: { value: " parent@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Child Name"), {
      target: { value: " Jordan " },
    });
    fireEvent.change(screen.getByLabelText("Child Password"), {
      target: { value: "kid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(childLoginSpy).toHaveBeenCalledWith({
        parent_email: "parent@example.com",
        child_name: "Jordan",
        password: "kid-password-123",
      }),
    );
    expect(loginSpy).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: "Child Today" }),
    ).toBeVisible();
  });

  it("shows inline error when login request fails", async () => {
    const loginSpy = vi.spyOn(apiClient, "login");
    loginSpy.mockRejectedValue(
      new ApiClientError(401, "Invalid email or password.", {
        detail: "Invalid email or password.",
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Login Email"), {
      target: { value: "parent@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not sign in: Invalid email or password.",
    );
  });

  it("shows inline error when child login request fails", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockReturnValue(
      new Promise<never>(() => undefined),
    );
    const childLoginSpy = vi.spyOn(apiClient, "childLogin");
    childLoginSpy.mockRejectedValue(
      new ApiClientError(
        409,
        "Multiple children have that name. Ask a parent to use a unique child name.",
        {
          detail:
            "Multiple children have that name. Ask a parent to use a unique child name.",
        },
      ),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Child" }));
    fireEvent.change(screen.getByLabelText("Parent Login Email"), {
      target: { value: "parent@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Child Name"), {
      target: { value: "Jordan" },
    });
    fireEvent.change(screen.getByLabelText("Child Password"), {
      target: { value: "wrong-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(childLoginSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not sign in: Multiple children have that name. Ask a parent to use a unique child name.",
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Login Email"), {
      target: { value: "parent@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByRole("button", { name: "Signing In..." }),
    ).toBeDisabled();
    expect(screen.getByText("Signing you in...")).toBeVisible();

    resolveLogin?.();

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("heading", { name: "Today" }),
    ).toBeVisible();
  });
});
