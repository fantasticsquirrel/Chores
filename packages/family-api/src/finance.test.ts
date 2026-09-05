import { describe, expect, it } from "vitest";

import { parseChoreTransactionDraft } from "./finance";

describe("parseChoreTransactionDraft", () => {
  it("maps valid dollar input to the existing transaction request", () => {
    expect(
      parseChoreTransactionDraft({
        amount: "12.345",
        childId: 7,
        memo: "Great teamwork",
        type: "BONUS",
      }),
    ).toEqual({
      error: null,
      payload: {
        child_id: 7,
        amount_cents: 1235,
        type: "BONUS",
        memo: "Great teamwork",
      },
    });
  });

  it("allows negative non-zero adjustments", () => {
    expect(
      parseChoreTransactionDraft({
        amount: "-2.50",
        childId: 7,
        memo: "Correction",
        type: "ADJUSTMENT",
      }),
    ).toEqual({
      error: null,
      payload: {
        child_id: 7,
        amount_cents: -250,
        type: "ADJUSTMENT",
        memo: "Correction",
      },
    });
  });

  it.each([
    ["PAYMENT", "-1", "Enter an amount greater than zero."],
    ["BONUS", "", "Enter an amount greater than zero."],
    ["ADJUSTMENT", "0", "Enter a non-zero adjustment."],
  ] as const)("rejects invalid %s input", (type, amount, error) => {
    expect(
      parseChoreTransactionDraft({ amount, childId: 7, memo: "", type }),
    ).toEqual({ error, payload: null });
  });
});
