import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { opsApi } from "./ops/api/client";
import type { OpsHouseholdDetail, OpsRole } from "@family-manager/family-api/ops-models";

type PlatformOpsRole = "PLATFORM_OWNER" | "PLATFORM_SUPPORT";

const detail: OpsHouseholdDetail = {
  id: 42,
  name: "Smith household",
  owner_email: "ow…@example.com",
  billing_status: "active",
  ownership: { household_id: 42, owner_user_id: 9, owner_email: "ow…@example.com" },
  billing: { status: "active", provider: "web", plan_name: "Family", expires_at: null, current_period_ends_at: "2027-02-01T00:00:00Z", available_actions: [] },
  entitlements: [{ key: "family", status: "active", expires_at: null }],
  support_cases: [{ id: 7, subject: "Login help", status: "open", created_at: "2026-07-01T00:00:00Z", notes: [] }],
};

function mockOps(role: PlatformOpsRole) {
  vi.spyOn(opsApi, "getCurrentOpsSession").mockResolvedValue({ user: { id: 1, email: "agent@example.com", role: role as OpsRole, mfa_required: true, mfa_verified: true }, csrf_token: null });
  vi.spyOn(opsApi, "getHousehold").mockResolvedValue(detail);
  vi.spyOn(opsApi, "listHouseholdEvents").mockResolvedValue([{ id: "e1", type: "subscription.changed", occurred_at: "2026-07-01T00:00:00Z", summary: "Subscription activated" }]);
  vi.spyOn(opsApi, "listAuditEntries").mockResolvedValue([{ id: "a1", actor_email: "ag…@example.com", action: "viewed", occurred_at: "2026-07-01T00:00:00Z", reason: null }]);
}

function renderDetail() {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ops/households/42"]}><App /></MemoryRouter>);
}

describe("separate ops routes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("signs in through the separate ops domain with password and MFA", async () => {
    vi.spyOn(opsApi, "getCurrentOpsSession").mockRejectedValue(new Error("Unauthorized"));
    const login = vi.spyOn(opsApi, "login").mockResolvedValue({
      user: { id: 1, email: "owner@example.com", role: "PLATFORM_OWNER" as OpsRole, mfa_required: true, mfa_verified: true },
      csrf_token: "ops-csrf",
    });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ops/login"]}><App /></MemoryRouter>);

    fireEvent.change(await screen.findByLabelText("Operator email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "platform-password" } });
    const mfaInput = screen.getByLabelText("MFA code");
    expect(mfaInput).toHaveAttribute("type", "text");
    fireEvent.change(mfaInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "platform-password",
      totp_code: "123456",
    }));
  });

  it("uses ops auth and never renders household navigation", async () => {
    mockOps("PLATFORM_SUPPORT");
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Smith household" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Operations" })).toBeVisible();
    expect(screen.queryByText("Child Today")).not.toBeInTheDocument();
    expect(screen.getByText("ow…@example.com")).toBeVisible();
    expect(screen.getByText("Subscription activated")).toBeVisible();
  });

  it("hides complimentary controls from support operators", async () => {
    mockOps("PLATFORM_SUPPORT");
    renderDetail();
    await screen.findByRole("heading", { name: "Smith household" });
    expect(screen.queryByRole("heading", { name: "Complimentary access" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Support cases" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Append note" })).toBeVisible();
  });

  it("requires finite expiry, reason, idempotency, and recent owner reauthentication for complimentary grants", async () => {
    mockOps("PLATFORM_OWNER");
    const reauthenticate = vi.spyOn(opsApi, "reauthenticate").mockResolvedValue();
    const grant = vi.spyOn(opsApi, "grantComplimentary").mockResolvedValue(detail);
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Complimentary access" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Grant or extend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Expiry, reason, idempotency key, password, and six-digit MFA code are required");
    expect(grant).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Expires at"), { target: { value: "2027-01-01T12:00" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Service recovery" } });
    fireEvent.change(screen.getByLabelText("Idempotency key"), { target: { value: "grant-42-2027" } });
    fireEvent.change(screen.getByLabelText("Owner password"), { target: { value: "owner-password" } });
    fireEvent.change(screen.getByLabelText("MFA code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Grant or extend" }));
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledWith({ password: "owner-password", totp_code: "123456" }));
    await waitFor(() => expect(grant).toHaveBeenCalledWith(42, {
      expires_at: new Date("2027-01-01T12:00").toISOString(),
      reason: "Service recovery",
      idempotency_key: "grant-42-2027",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Complimentary access updated.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("labels household search for the supported name, ID, and owner email behavior", async () => {
    mockOps("PLATFORM_SUPPORT");
    const search = vi.spyOn(opsApi, "searchHouseholds").mockResolvedValue([]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ops/households"]}><App /></MemoryRouter>);
    const input = await screen.findByRole("searchbox", { name: "Household name, ID, or owner email" });
    fireEvent.change(input, { target: { value: " owner@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(search).toHaveBeenCalledWith("owner@example.com"));
  });

  it("shows event fetch failures with an actionable retry instead of empty history", async () => {
    mockOps("PLATFORM_SUPPORT");
    const events = vi.spyOn(opsApi, "listHouseholdEvents")
      .mockRejectedValueOnce(new Error("Events unavailable"))
      .mockResolvedValueOnce([{ id: "e2", type: "subscription.changed", occurred_at: "2026-07-02T00:00:00Z", summary: "Subscription restored" }]);
    renderDetail();
    expect(await screen.findByText("Could not load events: Events unavailable")).toBeVisible();
    expect(screen.queryByText("No event summaries available.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry events" }));
    expect(await screen.findByText("Subscription restored")).toBeVisible();
    expect(events).toHaveBeenCalledTimes(2);
  });

  it("shows audit fetch failures with an actionable retry instead of empty history", async () => {
    mockOps("PLATFORM_SUPPORT");
    const audit = vi.spyOn(opsApi, "listAuditEntries")
      .mockRejectedValueOnce(new Error("Audit unavailable"))
      .mockResolvedValueOnce([{ id: "a2", actor_email: "ag…@example.com", action: "retried", occurred_at: "2026-07-02T00:00:00Z", reason: null }]);
    renderDetail();
    expect(await screen.findByText("Could not load audit: Audit unavailable")).toBeVisible();
    expect(screen.queryByText("No audit summaries available.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry audit" }));
    expect(await screen.findByText("retried · ag…@example.com")).toBeVisible();
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it("announces note and reconciliation successes politely", async () => {
    mockOps("PLATFORM_SUPPORT");
    vi.spyOn(opsApi, "appendSupportNote").mockResolvedValue({ id: 8, author_email: "ag…@example.com", body: "Checked account", created_at: "2026-07-02T00:00:00Z" });
    vi.spyOn(opsApi, "reconcileHousehold").mockResolvedValue(detail);
    renderDetail();
    await screen.findByRole("heading", { name: "Support cases" });
    fireEvent.change(screen.getByLabelText("Append-only note"), { target: { value: "Checked account" } });
    fireEvent.click(screen.getByRole("button", { name: "Append note" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Note appended.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    fireEvent.change(screen.getByLabelText("Reconciliation reason"), { target: { value: "Provider webhook delayed" } });
    fireEvent.click(screen.getByRole("button", { name: "Reconcile billing" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Billing projection reconciled.");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
