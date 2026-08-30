import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { apiClient } from "../api";
import { VerifyEmailPage } from "./VerifyEmailPage";

const TOKEN = "v1.registration-row-id-123456789012345678901234.abcdefghijklmnopqrstuvwxyzABCDEFGHI";
const BASE_PATH = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
const VERIFY_PATHNAME = `${BASE_PATH}/verify-email`;

function renderVerifyPage(pathname = VERIFY_PATHNAME) {
  window.history.replaceState(null, "", `${pathname}#token=${TOKEN}`);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

describe("VerifyEmailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("accepts a capability on the canonical verification route and clears the fragment", async () => {
    const verifyRegistration = vi.spyOn(apiClient, "verifyRegistration").mockResolvedValue({
      detail: "Email verification processed.",
    });

    renderVerifyPage();

    expect(window.location.hash).toBe("");
    await waitFor(() => expect(verifyRegistration).toHaveBeenCalledWith({ token: TOKEN }));
    expect(await screen.findByRole("heading", { name: "Email Verification Processed" })).toBeVisible();
  });

  it("rejects a verification capability presented on the password-reset route", () => {
    const verifyRegistration = vi.spyOn(apiClient, "verifyRegistration");

    renderVerifyPage(`${BASE_PATH}/reset-password`);

    expect(window.location.hash).toBe("");
    expect(verifyRegistration).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Verification Link Unavailable" })).toBeVisible();
  });
});
