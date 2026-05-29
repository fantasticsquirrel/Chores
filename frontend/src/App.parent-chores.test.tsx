import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient, type Child, type Chore } from "./api";

const children: Child[] = [
  { id: 11, household_id: 1, name: "Riley", active: true },
  { id: 12, household_id: 1, name: "Maya", active: true },
];

function buildChore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 21,
    household_id: 1,
    name: "Laundry",
    reward_cents: 250,
    reward_dollars: 2.5,
    start_date: "2026-02-23",
    expires_at: null,
    timeout_days: null,
    schedule_mode: "NONE",
    schedule_interval: null,
    schedule_unit: null,
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    archived_at: null,
    is_active: true,
    allowed_child_ids: [11],
    rotation_order: [],
    ...overrides,
  };
}

describe("Parent chores page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads chores and child eligibility labels", async () => {
    const listChoresSpy = vi.spyOn(apiClient, "listChores").mockResolvedValue([buildChore()]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Laundry")).toBeVisible();
    expect(screen.getByText(/Riley/u)).toBeVisible();
    expect(listChoresSpy).toHaveBeenCalledWith({ household_id: 1, active_only: false });
  });

  it("creates a static chore with selected children", async () => {
    const createdChore = buildChore({ id: 31, name: "Vacuum", reward_cents: 175, reward_dollars: 1.75 });
    vi.spyOn(apiClient, "listChores").mockResolvedValueOnce([]).mockResolvedValueOnce([createdChore]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    const createChoreSpy = vi.spyOn(apiClient, "createChore").mockResolvedValue(createdChore);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("No chores yet. Add one above to get started.");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Chore" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Vacuum" } });
    fireEvent.change(screen.getByLabelText("Reward ($)"), { target: { value: "1.75" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Riley" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chore" }));

    await waitFor(() =>
      expect(createChoreSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Vacuum",
        reward_cents: 175,
        start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
        schedule_mode: "NONE",
        schedule_interval: null,
        schedule_unit: null,
        completion_mode: "PER_CHILD",
        assignment_mode: "STATIC",
        allowed_child_ids: [11],
        rotation_order: [],
      }),
    );
    expect(await screen.findByText("Vacuum")).toBeVisible();
  });

  it("updates an existing chore", async () => {
    const updatedChore = buildChore({ name: "Fold towels", reward_cents: 300, reward_dollars: 3 });
    vi.spyOn(apiClient, "listChores").mockResolvedValueOnce([buildChore()]).mockResolvedValueOnce([updatedChore]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    const updateChoreSpy = vi.spyOn(apiClient, "updateChore").mockResolvedValue(updatedChore);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Laundry");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fold towels" } });
    fireEvent.change(screen.getByLabelText("Reward ($)"), { target: { value: "3.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateChoreSpy).toHaveBeenCalledWith(21, {
        household_id: 1,
        name: "Fold towels",
        reward_cents: 300,
        start_date: "2026-02-23",
        schedule_mode: "NONE",
        schedule_interval: null,
        schedule_unit: null,
        completion_mode: "PER_CHILD",
        assignment_mode: "STATIC",
        allowed_child_ids: [11],
        rotation_order: null,
      }),
    );
    expect(await screen.findByText("Fold towels")).toBeVisible();
  });

  it("archives a chore after confirmation and refreshes", async () => {
    vi.spyOn(apiClient, "listChores")
      .mockResolvedValueOnce([buildChore()])
      .mockResolvedValueOnce([buildChore({ archived_at: "2026-02-24T00:00:00Z", is_active: false })]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const archiveChoreSpy = vi.spyOn(apiClient, "archiveChore").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Laundry");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(archiveChoreSpy).toHaveBeenCalledWith(21, 1));
    const list = await screen.findByRole("list", { name: "Chores list" });
    expect(within(list).getByText("[archived]")).toBeVisible();
  });

  it("shows load errors", async () => {
    vi.spyOn(apiClient, "listChores").mockRejectedValue(
      new ApiClientError(503, "Service unavailable", { detail: "Service unavailable" }),
    );
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load chores: Service unavailable");
  });
});
