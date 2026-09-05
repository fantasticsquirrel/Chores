import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient, type ChoreTransaction } from "./api";

const bonusTransaction: ChoreTransaction = {
  id: 41,
  child_id: 11,
  amount_cents: 250,
  type: "BONUS",
  memo: "Great teamwork",
  created_at: "2026-09-05T10:00:00Z",
};

describe("Chore finance page", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listChildBalances").mockResolvedValue([
      { child_id: 11, child_name: "Riley", balance_cents: 500 },
    ]);
    vi.spyOn(apiClient, "listChoreTransactions").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a bonus with the existing payload and saving state", async () => {
    let resolveCreate: (transaction: ChoreTransaction) => void = () =>
      undefined;
    const createChoreTransaction = vi
      .spyOn(apiClient, "createChoreTransaction")
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/parent/money"]}
      >
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Record Activity" }),
    ).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Child balances" }),
    ).toHaveTextContent("Riley");
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "BONUS" },
    });
    fireEvent.change(screen.getByLabelText("Amount ($)"), {
      target: { value: "2.50" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Great teamwork" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));

    expect(
      await screen.findByRole("button", { name: "Saving..." }),
    ).toBeDisabled();
    expect(createChoreTransaction).toHaveBeenCalledWith({
      child_id: 11,
      amount_cents: 250,
      type: "BONUS",
      memo: "Great teamwork",
    });

    await act(async () => resolveCreate(bonusTransaction));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Record" })).toBeEnabled(),
    );
  });

  it("keeps finance mutations hidden from child sessions", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 21,
        household_id: 1,
        email: "riley@example.com",
        role: "CHILD",
        child_id: 11,
      },
      csrf_token: null,
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/child/history"]}
      >
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Money & History" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Record Activity" }),
    ).not.toBeInTheDocument();
  });
});
