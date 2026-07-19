import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse } from "../../api/models";
import { AccountScreen } from "./AccountScreen";

const ownerSession: AuthSessionResponse = {
  user: {
    id: 1,
    household_id: 2,
    email: "owner@example.com",
    role: "PARENT",
    child_id: null,
    is_household_owner: true,
  },
  csrf_token: null,
};

const noopLogout = async (): Promise<void> => undefined;

describe("AccountScreen subscription mode", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads billing lazily only after a household owner opens Subscription", async () => {
    const billing = jest.spyOn(apiClient, "getBillingStatus").mockResolvedValue({
      status: "complimentary",
      provider: null,
      plan_name: "Family Plus",
      expires_at: "2027-01-02T00:00:00Z",
      current_period_ends_at: null,
      available_actions: [],
    });

    render(<AccountScreen modules={[]} onLogout={noopLogout} session={ownerSession} />);

    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
    expect(billing).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Subscription"));

    expect(await screen.findByText("Complimentary access")).toBeTruthy();
    expect(screen.getByText(/Jan 2, 2027/)).toBeTruthy();
    expect(billing).toHaveBeenCalledTimes(1);
  });

  it.each([
    { role: "PARENT" as const, child_id: null },
    { role: "CHILD" as const, child_id: 3 },
  ])("does not expose or fetch billing for a non-owner $role", async ({ role, child_id }) => {
    const billing = jest.spyOn(apiClient, "getBillingStatus");
    const session: AuthSessionResponse = {
      ...ownerSession,
      user: { ...ownerSession.user, id: 2, role, child_id, is_household_owner: false },
    };

    render(<AccountScreen modules={[]} onLogout={noopLogout} session={session} />);

    expect(screen.queryByText("Subscription")).toBeNull();
    await waitFor(() => expect(billing).not.toHaveBeenCalled());
  });
});
