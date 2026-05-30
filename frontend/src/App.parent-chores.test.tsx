import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import {
  ApiClientError,
  apiClient,
  type Child,
  type Chore,
  type EligibleChore,
} from "./api";

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

function buildEligibleChore(
  overrides: Partial<EligibleChore> = {},
): EligibleChore {
  return {
    chore_id: 77,
    name: "Wipe table",
    reward_cents: 999,
    occurrence_date: "2026-02-23",
    expires_on: null,
    ...overrides,
  };
}

describe("Parent chores page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads chores, children, and the parent chore workspace", async () => {
    const listChoresSpy = vi
      .spyOn(apiClient, "listChores")
      .mockResolvedValue([buildChore()]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Chores" }),
    ).toBeVisible();
    expect(screen.getByText("Daily Board")).toBeVisible();
    expect(screen.getByText("Selected Child Submit")).toBeVisible();
    expect(await screen.findByText("Laundry")).toBeVisible();
    await waitFor(() =>
      expect(screen.getAllByText("Riley").length).toBeGreaterThan(0),
    );
    expect(screen.queryByLabelText("Reward ($)")).not.toBeInTheDocument();
    expect(listChoresSpy).toHaveBeenCalledWith({
      household_id: 1,
      active_only: false,
    });
  });

  it("creates a static chore with selected children and zero reward", async () => {
    const createdChore = buildChore({
      id: 31,
      name: "Vacuum",
      reward_cents: 0,
      reward_dollars: 0,
    });
    vi.spyOn(apiClient, "listChores")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdChore]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);
    const createChoreSpy = vi
      .spyOn(apiClient, "createChore")
      .mockResolvedValue(createdChore);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("No chores yet. Add one above to get started.");
    fireEvent.click(screen.getAllByRole("button", { name: "Add Chore" })[0]);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Vacuum" },
    });
    expect(screen.queryByLabelText("Reward ($)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Riley" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Chore" }));

    await waitFor(() =>
      expect(createChoreSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Vacuum",
        reward_cents: 0,
        start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
        expires_at: null,
        timeout_days: null,
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

  it("updates an existing chore without sending reward fields", async () => {
    const updatedChore = buildChore({ name: "Fold towels" });
    vi.spyOn(apiClient, "listChores")
      .mockResolvedValueOnce([buildChore()])
      .mockResolvedValueOnce([updatedChore]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);
    const updateChoreSpy = vi
      .spyOn(apiClient, "updateChore")
      .mockResolvedValue(updatedChore);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Laundry");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Fold towels" },
    });
    expect(screen.queryByLabelText("Reward ($)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateChoreSpy).toHaveBeenCalled());
    expect(updateChoreSpy).toHaveBeenCalledWith(21, {
      household_id: 1,
      name: "Fold towels",
      start_date: "2026-02-23",
      expires_at: null,
      timeout_days: null,
      schedule_mode: "NONE",
      schedule_interval: null,
      schedule_unit: null,
      completion_mode: "PER_CHILD",
      assignment_mode: "STATIC",
      allowed_child_ids: [11],
      rotation_order: null,
    });
    expect(updateChoreSpy.mock.calls[0]?.[1]).not.toHaveProperty(
      "reward_cents",
    );
    expect(await screen.findByText("Fold towels")).toBeVisible();
  });

  it("quick-submits one child chore from the daily board", async () => {
    const eligibleChore = buildEligibleChore();
    vi.spyOn(apiClient, "listChores").mockResolvedValue([]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockImplementation(
      async (params) => (params.child_id === 11 ? [eligibleChore] : []),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const createSubmissionSpy = vi
      .spyOn(apiClient, "createSubmission")
      .mockResolvedValue({
        id: 99,
        child_id: 11,
        for_date: "2026-02-23",
        status: "PENDING",
        items: [{ chore_id: 77, status: "PENDING" }],
      });

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Wipe table/u }));

    await waitFor(() =>
      expect(createSubmissionSpy).toHaveBeenCalledWith(
        {
          for_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
          chore_ids: [77],
        },
        { child_id: 11 },
      ),
    );
    expect(screen.queryByText(/\$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Potential/u)).not.toBeInTheDocument();
  });

  it("submits selected chores for the selected child", async () => {
    const eligibleChore = buildEligibleChore();
    vi.spyOn(apiClient, "listChores").mockResolvedValue([]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockImplementation(
      async (params) => (params.child_id === 11 ? [eligibleChore] : []),
    );
    const createSubmissionSpy = vi
      .spyOn(apiClient, "createSubmission")
      .mockResolvedValue({
        id: 100,
        child_id: 11,
        for_date: "2026-02-23",
        status: "PENDING",
        items: [{ chore_id: 77, status: "PENDING" }],
      });

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("checkbox", { name: /Wipe table/u }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit Selected Chores" }),
    );

    await waitFor(() =>
      expect(createSubmissionSpy).toHaveBeenCalledWith(
        {
          for_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
          chore_ids: [77],
        },
        { child_id: 11 },
      ),
    );
  });

  it("archives a chore after confirmation and refreshes", async () => {
    vi.spyOn(apiClient, "listChores")
      .mockResolvedValueOnce([buildChore()])
      .mockResolvedValueOnce([
        buildChore({ archived_at: "2026-02-24T00:00:00Z", is_active: false }),
      ]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const archiveChoreSpy = vi
      .spyOn(apiClient, "archiveChore")
      .mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Laundry");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(archiveChoreSpy).toHaveBeenCalledWith(21, 1));
    const list = await screen.findByRole("list", { name: "Chores list" });
    expect(within(list).getByText("archived")).toBeVisible();
  });

  it("shows load errors", async () => {
    vi.spyOn(apiClient, "listChores").mockRejectedValue(
      new ApiClientError(503, "Service unavailable", {
        detail: "Service unavailable",
      }),
    );
    vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/chores"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load chores: Service unavailable",
    );
  });
});
