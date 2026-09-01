import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient } from "./api";

const ticket = { id: 1, ticket_number: "42001", title: "Need help", state: "new", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", articles: [] };

describe("Support page", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({ user: { id: 1, household_id: 1, email: "parent@example.com", role: "PARENT" }, csrf_token: "token" });
    vi.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [{ key: "support", name: "Support", description: "" }] });
    vi.spyOn(apiClient, "getSupportStatus").mockResolvedValue({ enabled: true });
    vi.spyOn(apiClient, "listSupportTickets").mockResolvedValue([ticket]);
    vi.spyOn(apiClient, "getSupportTicket").mockResolvedValue({ ...ticket, articles: [{ id: 3, body: "We are looking at it.", created_at: "2026-09-01T00:01:00Z" }] });
    vi.spyOn(apiClient, "createSupportTicket").mockResolvedValue(ticket);
    vi.spyOn(apiClient, "replySupportTicket").mockResolvedValue(ticket);
  });

  afterEach(() => vi.restoreAllMocks());

  it("lists, creates, opens, and replies to tickets", async () => {
    render(<MemoryRouter initialEntries={["/support"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Family Support" })).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: /42001/u }));
    expect(await screen.findByText("We are looking at it.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Reply"), { target: { value: "Thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(apiClient.replySupportTicket).toHaveBeenCalledWith(1, "Thanks"));
  });

  it("shows the prepared-but-disabled state", async () => {
    vi.mocked(apiClient.getSupportStatus).mockResolvedValue({ enabled: false });
    render(<MemoryRouter initialEntries={["/support"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
    expect(await screen.findByText("Ticket support is prepared but not enabled yet.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open ticket" })).toBeDisabled();
  });
});

