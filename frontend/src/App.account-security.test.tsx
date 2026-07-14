import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Account security page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows authenticated users to navigate to account security and change password", async () => {
    vi.spyOn(apiClient, "changePassword").mockResolvedValue(undefined);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("link", { name: "Account Security" }));
    expect(await screen.findByRole("heading", { name: "Account Security" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-password-456" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "new-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() =>
      expect(apiClient.changePassword).toHaveBeenCalledWith({
        current_password: "password123",
        new_password: "new-password-456",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
    expect(screen.getByText("Password changed. Sign in again with your new password.")).toBeVisible();
  });

  it("shows client-side mismatch validation and does not call API", async () => {
    const changePasswordSpy = vi.spyOn(apiClient, "changePassword");

    render(
      <MemoryRouter initialEntries={["/account/security"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Current Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-password-456" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not change password: New password and confirm password must match.",
    );
    expect(changePasswordSpy).not.toHaveBeenCalled();
  });

  it("shows API error when password update fails", async () => {
    vi.spyOn(apiClient, "changePassword").mockRejectedValue(
      new ApiClientError(400, "Current password is incorrect.", {
        detail: "Current password is incorrect.",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/account/security"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Current Password"), { target: { value: "wrong-pass" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "new-password-456" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "new-password-456" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not change password: Current password is incorrect.",
    );
  });


  it("redirects legacy account security route to the clean route", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 8,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });

    render(
      <MemoryRouter initialEntries={["/chore/account/security"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Account Security" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Account Security" })).toHaveAttribute("href", "/account/security");
  });
});
