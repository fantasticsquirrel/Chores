import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { apiClient } from "../api";
import { isPasswordResetOriginTrustedForConfiguration } from "../lib/password-reset-token";
import { ResetPasswordPage } from "./ResetPasswordPage";

const TOKEN = "v1.reset-row-id-12345678901234567890123456789012.abcdefghijklmnopqrstuvwxyzABCDEFGHI";
const TEST_RESET_PATHNAME = `${import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}/reset-password`;

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="route-probe">{`${location.pathname}${location.search}`}</output>;
}

function renderResetPage(hash = `#token=${TOKEN}`, search = "", pathname = TEST_RESET_PATHNAME) {
  // Vitest's build config embeds the canonical test-only loopback origin.
  // Production defaults to the deployed HTTPS origin; isolated smoke injects
  // its wrapper-owned loopback origin only during a disposable build.
  window.history.replaceState(null, "", `${pathname}${search}${hash}`);
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/reset-password"]}
    >
      <ResetPasswordPage />
      <RouteProbe />
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
  });

  it("captures the fragment capability once and removes it before presenting the form", () => {
    renderResetPage();

    expect(window.location.hash).toBe("");
    expect(screen.getByRole("heading", { name: "Set a New Password" })).toBeVisible();
    expect(screen.queryByText(TOKEN)).toBeNull();
  });

  it("accepts only the deployed origin or the smoke wrapper's exact loopback origin", () => {
    expect(isPasswordResetOriginTrustedForConfiguration(
      "https://family.multihost.ing",
      "https://family.multihost.ing",
    )).toBe(true);
    expect(isPasswordResetOriginTrustedForConfiguration(
      "https://attacker.invalid",
      "https://family.multihost.ing",
    )).toBe(false);

    expect(isPasswordResetOriginTrustedForConfiguration(
      "http://127.0.0.1:18501",
      "http://127.0.0.1:18501",
    )).toBe(true);
    expect(isPasswordResetOriginTrustedForConfiguration(
      "https://family.multihost.ing",
      "http://127.0.0.1:18501",
    )).toBe(false);

    expect(isPasswordResetOriginTrustedForConfiguration(
      "https://attacker.invalid",
      "https://attacker.invalid",
    )).toBe(false);
  });

  it("rejects a query-bearing reset URL even when its fragment contains an otherwise valid capability", () => {
    renderResetPage(`#token=${TOKEN}`, "?unexpected=1");

    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("heading", { name: "Reset Link Unavailable" })).toBeVisible();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("rejects a trailing-slash reset route instead of accepting its capability", () => {
    renderResetPage(`#token=${TOKEN}`, "", `${TEST_RESET_PATHNAME}/`);

    expect(window.location.href).not.toContain(TOKEN);
    expect(screen.getByRole("heading", { name: "Reset Link Unavailable" })).toBeVisible();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("rejects fragments with unsupported extra parameters", () => {
    renderResetPage(`#token=${TOKEN}&next=%2Fparent%2Fdashboard`);

    expect(window.location.href).not.toContain(TOKEN);
    expect(screen.getByRole("heading", { name: "Reset Link Unavailable" })).toBeVisible();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("does not present a reset form when the fragment contains no usable capability", () => {
    renderResetPage("");

    expect(screen.getByRole("heading", { name: "Reset Link Unavailable" })).toBeVisible();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("keeps the token out of request URLs, validates confirmation locally, then navigates to generic sign-in guidance", async () => {
    const confirmPasswordReset = vi.spyOn(apiClient, "confirmPasswordReset").mockResolvedValue({
      detail: "Try signing in. If you cannot sign in, request a new reset link.",
    });
    renderResetPage();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "a sufficiently long parent password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "different sufficiently long password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set New Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("New password and confirmation must match.");
    expect(confirmPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "a sufficiently long parent password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set New Password" }));

    await waitFor(() =>
      expect(confirmPasswordReset).toHaveBeenCalledWith({
        token: TOKEN,
        new_password: "a sufficiently long parent password",
      }),
    );
    // The client call resolves before React commits the ensuing router state.
    // Await the navigation rather than relying on a scheduler-specific
    // microtask ordering (which differs across supported Node runtimes).
    await waitFor(() =>
      expect(screen.getByTestId("route-probe")).toHaveTextContent("/login?passwordReset=1"),
    );
    expect(window.location.href).not.toContain(TOKEN);
  });
});
