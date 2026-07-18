import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { opsApi } from "./ops/api/client";
import type { OpsHouseholdDetail, OpsRole } from "@family-manager/family-api/ops-models";

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

function mockOps(role: OpsRole) {
  vi.spyOn(opsApi, "getCurrentOpsSession").mockResolvedValue({ user: { id: 1, email: "agent@example.com", role, mfa_required: true, mfa_verified: true }, csrf_token: null });
  vi.spyOn(opsApi, "getHousehold").mockResolvedValue(detail);
  vi.spyOn(opsApi, "listHouseholdEvents").mockResolvedValue([{ id: "e1", type: "subscription.changed", occurred_at: "2026-07-01T00:00:00Z", summary: "Subscription activated" }]);
  vi.spyOn(opsApi, "listAuditEntries").mockResolvedValue([{ id: "a1", actor_email: "ag…@example.com", action: "viewed", occurred_at: "2026-07-01T00:00:00Z", reason: null }]);
}

function renderDetail() {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/ops/households/42"]}><App /></MemoryRouter>);
}

describe("separate ops routes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses ops auth and never renders household navigation", async () => {
    mockOps("SUPPORT");
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Smith household" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Operations" })).toBeVisible();
    expect(screen.queryByText("Child Today")).not.toBeInTheDocument();
    expect(screen.getByText("ow…@example.com")).toBeVisible();
    expect(screen.getByText("Subscription activated")).toBeVisible();
  });

  it("hides complimentary controls from support operators", async () => {
    mockOps("SUPPORT");
    renderDetail();
    await screen.findByRole("heading", { name: "Smith household" });
    expect(screen.queryByRole("heading", { name: "Complimentary access" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Support cases" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Append note" })).toBeVisible();
  });

  it("requires finite expiry, reason, and idempotency for owner complimentary grants", async () => {
    mockOps("OWNER");
    const grant = vi.spyOn(opsApi, "grantComplimentary").mockResolvedValue(detail);
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Complimentary access" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Grant or extend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Expiry, reason, and idempotency key are required");
    expect(grant).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Expires at"), { target: { value: "2027-01-01T12:00" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Service recovery" } });
    fireEvent.change(screen.getByLabelText("Idempotency key"), { target: { value: "grant-42-2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Grant or extend" }));
    await waitFor(() => expect(grant).toHaveBeenCalledWith(42, {
      expires_at: new Date("2027-01-01T12:00").toISOString(),
      reason: "Service recovery",
      idempotency_key: "grant-42-2027",
    }));
  });
});
