import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient } from "./api";

function renderAccount() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/account"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("household account subscription", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads and renders complimentary billing only for a household owner", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: { id: 1, household_id: 2, email: "owner@example.com", role: "PARENT", child_id: null, is_household_owner: true },
      csrf_token: null,
    });
    const billing = vi.spyOn(apiClient, "getBillingStatus").mockResolvedValue({
      status: "complimentary",
      provider: null,
      plan_name: "Family Plus",
      expires_at: "2027-01-02T00:00:00Z",
      current_period_ends_at: null,
      available_actions: [],
    });

    renderAccount();

    expect(await screen.findByRole("heading", { name: "Subscription" })).toBeVisible();
    expect(await screen.findByText("Complimentary access")).toBeVisible();
    expect(screen.getByText(/Jan 2, 2027/)).toBeVisible();
    expect(screen.getByText("No payment provider is connected.")).toBeVisible();
    expect(billing).toHaveBeenCalledTimes(1);
  });

  it.each([
    { role: "PARENT" as const, owner: false },
    { role: "CHILD" as const, owner: false },
  ])("does not expose or fetch billing for $role non-owner", async ({ role, owner }) => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: { id: 2, household_id: 2, email: "member@example.com", role, child_id: role === "CHILD" ? 3 : null, is_household_owner: owner },
      csrf_token: null,
    });
    const billing = vi.spyOn(apiClient, "getBillingStatus");

    renderAccount();

    expect(await screen.findByRole("heading", { name: "Account Security" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Subscription" })).not.toBeInTheDocument();
    expect(billing).not.toHaveBeenCalled();
  });

  it("defers server-advertised billing actions without calling the absent action endpoint", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: { id: 1, household_id: 2, email: "owner@example.com", role: "PARENT_ADMIN", child_id: null, is_household_owner: true },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "getBillingStatus").mockResolvedValue({
      status: "none",
      provider: "web",
      plan_name: null,
      expires_at: null,
      current_period_ends_at: null,
      available_actions: [{ key: "start_subscription", label: "Choose a plan" }],
    });
    renderAccount();
    const action = await screen.findByRole("button", { name: "Choose a plan" });
    expect(action).toBeDisabled();
    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.getByText("Billing actions are not available yet.")).toBeVisible();
  });
});
