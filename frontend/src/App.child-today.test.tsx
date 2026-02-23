import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Child today page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and renders eligible chores for the selected date", async () => {
    const listEligibleChoresSpy = vi.spyOn(apiClient, "listEligibleChores");
    listEligibleChoresSpy.mockResolvedValue([
      {
        chore_id: 21,
        name: "Unload Dishwasher",
        reward_cents: 250,
        occurrence_date: "2026-02-23",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading eligible chores...")).toBeVisible();
    expect(await screen.findByText("Unload Dishwasher")).toBeVisible();
    expect(listEligibleChoresSpy).toHaveBeenCalledWith({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u) });
  });

  it("submits selected chores and refreshes eligibility list", async () => {
    const listEligibleChoresSpy = vi.spyOn(apiClient, "listEligibleChores");
    listEligibleChoresSpy
      .mockResolvedValueOnce([
        {
          chore_id: 7,
          name: "Make Bed",
          reward_cents: 150,
          occurrence_date: "2026-02-23",
        },
      ])
      .mockResolvedValueOnce([
        {
          chore_id: 7,
          name: "Make Bed",
          reward_cents: 150,
          occurrence_date: "2026-02-23",
        },
      ]);

    const createSubmissionSpy = vi.spyOn(apiClient, "createSubmission");
    createSubmissionSpy.mockResolvedValue({
      id: 99,
      child_id: 1,
      for_date: "2026-02-23",
      status: "PENDING",
      items: [{ chore_id: 7, status: "PENDING" }],
    });

    render(
      <MemoryRouter initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Make Bed");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit Selected Chores" }));

    await waitFor(() =>
      expect(createSubmissionSpy).toHaveBeenCalledWith({
        for_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
        chore_ids: [7],
      }),
    );
    expect(await screen.findByText("Submitted 1 chore(s) for review.")).toBeVisible();
    expect(listEligibleChoresSpy).toHaveBeenCalledTimes(2);
  });

  it("shows error and empty states for eligible chores loading", async () => {
    vi.spyOn(apiClient, "listEligibleChores")
      .mockRejectedValueOnce(new ApiClientError(503, "Service unavailable", { detail: "Service unavailable" }))
      .mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load chores: Service unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("No eligible chores for this date.")).toBeVisible();
  });
});
