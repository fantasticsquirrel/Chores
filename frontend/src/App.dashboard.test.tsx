import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent dashboard", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listChildBalances").mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows approvals before eligibility completes and retries only a failed child", async () => {
    let reject!: (error: Error) => void;
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([
      { id: 1, household_id: 1, name: "Maya", active: true },
    ]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([
      {
        id: 9,
        child_id: 1,
        child_name: "Maya",
        for_date: "2026-02-23",
        status: "PENDING",
        items: [],
      },
    ]);
    vi.mocked(apiClient.listChildBalances).mockResolvedValue([
      { child_id: 1, child_name: "Maya", balance_cents: 1500 },
    ]);
    const eligible = vi
      .spyOn(apiClient, "listEligibleChores")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("link", { name: "Review 1 submission" }),
    ).toBeVisible();
    expect(screen.getByText("$15.00")).toBeVisible();
    await act(async () => reject(new Error("Eligibility offline")));
    expect(await screen.findByText(/Maya.*unavailable/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry Maya’s chores" }),
    );
    await waitFor(() => expect(eligible).toHaveBeenCalledTimes(2));
    expect(apiClient.listSubmissions).toHaveBeenCalledTimes(1);
    expect(apiClient.listChildBalances).toHaveBeenCalledTimes(1);
    expect(apiClient.listChildren).toHaveBeenCalledTimes(1);
  });

  it.each(["listChildren", "listSubmissions", "listChildBalances"] as const)(
    "isolates %s failure with a targeted retry",
    async (method) => {
      vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
      vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
      vi.mocked(apiClient.listChildBalances).mockResolvedValue([]);
      vi.mocked(apiClient[method]).mockRejectedValueOnce(
        new Error("Unavailable service"),
      );
      render(
        <MemoryRouter initialEntries={["/parent/dashboard"]}>
          <App />
        </MemoryRouter>,
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unavailable service",
      );
      const labels = {
        listChildren: "Retry children",
        listSubmissions: "Retry approvals",
        listChildBalances: "Retry balances",
      };
      fireEvent.click(screen.getByRole("button", { name: labels[method] }));
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
      for (const request of [
        "listChildren",
        "listSubmissions",
        "listChildBalances",
      ] as const)
        expect(apiClient[request]).toHaveBeenCalledTimes(
          request === method ? 2 : 1,
        );
    },
  );

  it("renders Today chores and allowance totals", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([
      { id: 1, household_id: 1, name: "Maya", active: true },
    ]);
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");
    listSubmissionsSpy.mockResolvedValue([
      {
        id: 9,
        child_id: 1,
        child_name: "Maya",
        for_date: "2026-02-23",
        status: "PENDING",
        items: [],
      },
    ]);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([
      {
        chore_id: 4,
        name: "Unload dishwasher",
        reward_cents: 0,
        occurrence_date: "2026-02-23",
        expires_on: null,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Today" })).toBeVisible();
    expect(await screen.findByText("Maya · 1 chore due")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Review 1 submission" }),
    ).toHaveAttribute("href", "/board");
    expect(
      screen.getByText("Pending Submissions").closest("article"),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("link", { name: "Manage Children" }),
    ).toHaveAttribute("href", "/parent/children");
    expect(screen.getByRole("link", { name: "Open Review" })).toHaveAttribute(
      "href",
      "/board",
    );
    expect(screen.getByText("Total Amount Owed")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Maya’s chores" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(
        /^\/parent\/chores\?childId=1&date=\d{4}-\d{2}-\d{2}$/,
      ),
    );
    const today = screen.getByRole("heading", { name: "Today" });
    expect(
      today.compareDocumentPosition(
        screen.getByRole("heading", { name: "Household summary" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Money & History" })).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 1 });
    expect(listSubmissionsSpy).toHaveBeenCalledWith({ status: "PENDING" });
  });

  it("shows an error message when children loading fails", async () => {
    vi.spyOn(apiClient, "listChildren").mockRejectedValue(
      new ApiClientError(503, "Backend unavailable", {
        detail: "Backend unavailable",
      }),
    );
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load children: Backend unavailable",
    );
  });

  it("uses authenticated household scope for dashboard data loading", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 22,
        household_id: 42,
        email: "parent42@example.com",
        role: "PARENT",
        is_household_owner: false,
        child_id: null,
      },
      csrf_token: null,
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([
      { id: 5, household_id: 42, name: "Ari", active: true },
    ]);
    vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/All caught up/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show all 1 child" }));
    expect(await screen.findByText(/Ari · 0 chores due/u)).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 42 });
  });

  it("does not register or load chore dashboard cards without effective access", async () => {
    vi.mocked(apiClient.getMyModules).mockResolvedValue({
      modules: [
        {
          key: "homeschool",
          name: "Homeschool",
          description: "",
        },
      ],
    });
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    const listSubmissionsSpy = vi.spyOn(apiClient, "listSubmissions");

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", { name: "Open Homeschool" }),
    ).toBeVisible();
    expect(screen.queryByText("Pending Submissions")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Review" }),
    ).not.toBeInTheDocument();
    expect(listChildrenSpy).not.toHaveBeenCalled();
    expect(listSubmissionsSpy).not.toHaveBeenCalled();
  });
});
