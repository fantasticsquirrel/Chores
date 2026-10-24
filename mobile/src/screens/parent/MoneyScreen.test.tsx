import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { TextInput } from "react-native";

import { apiClient } from "../../api/client";
import type { ChildBalance, ChoreTransaction } from "../../api/models";
import { MoneyScreen } from "./MoneyScreen";

const balance: ChildBalance = {
  balance_cents: 1250,
  child_id: 3,
  child_name: "Mia",
};

const transaction: ChoreTransaction = {
  amount_cents: 250,
  child_id: 3,
  created_at: "2026-09-05T12:00:00Z",
  id: 11,
  memo: "Great teamwork",
  type: "BONUS",
};

function arrangeSuccessfulLoad() {
  jest.spyOn(apiClient, "listChildBalances").mockResolvedValue([balance]);
  jest
    .spyOn(apiClient, "listChoreTransactions")
    .mockResolvedValue([transaction]);
}

describe("MoneyScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads balances and history and preserves financial action payloads", async () => {
    arrangeSuccessfulLoad();
    const createTransaction = jest
      .spyOn(apiClient, "createChoreTransaction")
      .mockResolvedValue(transaction);

    const view = render(<MoneyScreen />);

    expect(await screen.findByText("Mia")).toBeTruthy();
    expect(screen.getByText("Great teamwork")).toBeTruthy();
    expect(apiClient.listChildBalances).toHaveBeenCalledTimes(1);
    expect(apiClient.listChoreTransactions).toHaveBeenCalledWith(3);

    fireEvent.press(screen.getByRole("button", { name: "Bonus" }));
    const inputs = view.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], "2.75");
    fireEvent.changeText(inputs[1], "Extra help");
    fireEvent.press(screen.getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(createTransaction).toHaveBeenCalledWith({
        amount_cents: 275,
        child_id: 3,
        memo: "Extra help",
        type: "BONUS",
      }),
    );
  });

  it("names the selected recipient, previews signed balances and locks rapid taps", async () => {
    arrangeSuccessfulLoad();
    let resolve!: (value: ChoreTransaction) => void;
    const create = jest
      .spyOn(apiClient, "createChoreTransaction")
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    render(<MoneyScreen />);
    expect(await screen.findByText("Record payment for Mia")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mia, $12.50, selected" }).props
        .accessibilityState.selected,
    ).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Amount ($)"), "2.50");
    expect(
      screen.getByText("Amount owed: $12.50 → $10.00 after this payment."),
    ).toBeTruthy();
    const record = screen.getByRole("button", { name: "Record" });
    act(() => {
      fireEvent.press(record);
      fireEvent.press(record);
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Saving..." }).props.accessibilityState
        .disabled,
    ).toBe(true);
    await act(async () =>
      resolve({ ...transaction, type: "PAYMENT", amount_cents: -250 }),
    );
    expect(screen.getByText("Payment recorded for Mia.")).toBeTruthy();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT",
        amount_cents: 250,
        child_id: 3,
      }),
    );
  });

  it("allows negative adjustment entry and previews its signed effect", async () => {
    arrangeSuccessfulLoad();
    render(<MoneyScreen />);
    await screen.findByText("Record payment for Mia");
    fireEvent.press(screen.getByRole("button", { name: "Adjustment" }));
    expect(screen.getByLabelText("Amount ($)").props.keyboardType).toBe(
      "numbers-and-punctuation",
    );
    fireEvent.changeText(screen.getByLabelText("Amount ($)"), "-2.50");
    expect(
      screen.getByText("Amount owed: $12.50 → $10.00 after this adjustment."),
    ).toBeTruthy();
  });

  it("keeps a successful write distinct from a failed history refresh", async () => {
    arrangeSuccessfulLoad();
    jest
      .spyOn(apiClient, "createChoreTransaction")
      .mockResolvedValue(transaction);
    render(<MoneyScreen />);
    await screen.findByText("Great teamwork");
    jest
      .mocked(apiClient.listChoreTransactions)
      .mockRejectedValueOnce(new Error("History offline"));
    fireEvent.changeText(screen.getByLabelText("Amount ($)"), "2");
    fireEvent.press(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText("Payment recorded for Mia.")).toBeTruthy();
    expect(
      await screen.findByText(/Could not refresh history: History offline/),
    ).toBeTruthy();
    expect(screen.queryByText(/Could not record activity/)).toBeNull();
  });

  it("keeps financial mutations hidden in read-only mode", async () => {
    arrangeSuccessfulLoad();

    render(<MoneyScreen readOnly />);

    expect(await screen.findByText("Mia")).toBeTruthy();
    expect(screen.queryByText("Record Activity")).toBeNull();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
  });
});
