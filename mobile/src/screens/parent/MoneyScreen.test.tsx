import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
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

  it("keeps financial mutations hidden in read-only mode", async () => {
    arrangeSuccessfulLoad();

    render(<MoneyScreen readOnly />);

    expect(await screen.findByText("Mia")).toBeTruthy();
    expect(screen.queryByText("Record Activity")).toBeNull();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
  });
});
