import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent submission review page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and displays pending submissions", async () => {
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");
    listSubmissionsSpy.mockResolvedValue([
      {
        id: 8,
        child_id: 1,
        child_name: "Maya",
        for_date: "2026-02-23",
        status: "PENDING",
        items: [
          {
            id: 21,
            chore_id: 12,
            chore_name: "Dishes",
            chore_reward_cents: 300,
            status: "PENDING",
          },
        ],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/board"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading pending submissions...")).toBeVisible();
    expect(await screen.findByText("Maya")).toBeVisible();
    expect(screen.getByText("Dishes")).toBeVisible();
    expect(listSubmissionsSpy).toHaveBeenCalledWith({ status: "PENDING" });
  });

  it("approves all items for a submission and refreshes", async () => {
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");
    listSubmissionsSpy
      .mockResolvedValueOnce([
        {
          id: 8,
          child_id: 1,
          child_name: "Maya",
          for_date: "2026-02-23",
          status: "PENDING",
          items: [
            {
              id: 21,
              chore_id: 12,
              chore_name: "Dishes",
              chore_reward_cents: 300,
              status: "PENDING",
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    const approveSubmissionSpy = vi.spyOn(apiClient, "approveSubmission");
    approveSubmissionSpy.mockResolvedValue({
      id: 8,
      child_id: 1,
      child_name: "Maya",
      for_date: "2026-02-23",
      status: "APPROVED",
      items: [],
    });

    render(
      <MemoryRouter initialEntries={["/board"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Maya");
    fireEvent.click(screen.getByRole("button", { name: "Approve All" }));

    await waitFor(() => expect(approveSubmissionSpy).toHaveBeenCalledWith(8));
    expect(await screen.findByText("No pending submissions right now.")).toBeVisible();
    expect(listSubmissionsSpy).toHaveBeenCalledTimes(2);
  });

  it("decides an individual item and refreshes", async () => {
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");
    listSubmissionsSpy
      .mockResolvedValueOnce([
        {
          id: 8,
          child_id: 1,
          child_name: "Maya",
          for_date: "2026-02-23",
          status: "PENDING",
          items: [
            {
              id: 21,
              chore_id: 12,
              chore_name: "Dishes",
              chore_reward_cents: 300,
              status: "PENDING",
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 8,
          child_id: 1,
          child_name: "Maya",
          for_date: "2026-02-23",
          status: "PENDING",
          items: [
            {
              id: 21,
              chore_id: 12,
              chore_name: "Dishes",
              chore_reward_cents: 300,
              status: "REJECTED",
            },
          ],
        },
      ]);
    const decideSubmissionItemSpy = vi.spyOn(apiClient, "decideSubmissionItem");
    decideSubmissionItemSpy.mockResolvedValue({
      id: 8,
      child_id: 1,
      child_name: "Maya",
      for_date: "2026-02-23",
      status: "PENDING",
      items: [
        {
          id: 21,
          chore_id: 12,
          chore_name: "Dishes",
          chore_reward_cents: 300,
          status: "REJECTED",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/board"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Dishes");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(decideSubmissionItemSpy).toHaveBeenCalledWith(8, 21, {
        status: "REJECTED",
      }),
    );
    expect(await screen.findByText("REJECTED")).toBeVisible();
    expect(listSubmissionsSpy).toHaveBeenCalledTimes(2);
  });

  it("shows error state when loading fails", async () => {
    vi.spyOn(apiClient, "listSubmissions").mockRejectedValue(
      new ApiClientError(503, "Service unavailable", {
        detail: "Service unavailable",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/board"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load submissions: Service unavailable");
  });
});
