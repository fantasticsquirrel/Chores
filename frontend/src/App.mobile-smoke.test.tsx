import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient } from "./api";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

function applyMobileViewport(): void {
  window.innerWidth = MOBILE_VIEWPORT.width;
  window.innerHeight = MOBILE_VIEWPORT.height;
  window.dispatchEvent(new Event("resize"));
}

describe("Mobile browser smoke flows", () => {
  beforeEach(() => {
    applyMobileViewport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs parent key flow on mobile: load and create child", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy
      .mockResolvedValueOnce([{ id: 1, household_id: 1, name: "Maya", active: true }])
      .mockResolvedValueOnce([
        { id: 1, household_id: 1, name: "Maya", active: true },
        { id: 2, household_id: 1, name: "Leo", active: true },
      ]);
    const createChildSpy = vi.spyOn(apiClient, "createChild");
    createChildSpy.mockResolvedValue({ id: 2, household_id: 1, name: "Leo", active: true });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Children Management" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Today" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Child Today" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Leo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Child" }));

    await waitFor(() =>
      expect(createChildSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Leo",
        active: true,
      }),
    );
    const childrenList = await screen.findByRole("list", { name: "Children list" });
    expect(within(childrenList).getByText("Leo")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledTimes(2);
  });

  it("runs child key flow on mobile: load chores and submit selection", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 7,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        child_id: 12,
      },
      csrf_token: null,
    });
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/child/today"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Child Today" })).toBeVisible();
    expect(await screen.findByText("Make Bed")).toBeVisible();

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
});
