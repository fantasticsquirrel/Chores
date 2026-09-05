import type {
  ChoreTransactionType,
  CreateChoreTransactionRequest,
} from "./models/finance";

export type ChoreTransactionActionType = Exclude<
  ChoreTransactionType,
  "CHORE_APPROVAL"
>;

export type ChoreTransactionDraft = {
  amount: string;
  childId: number;
  memo: string;
  type: ChoreTransactionActionType;
};

export type ChoreTransactionDraftResult =
  | { error: null; payload: CreateChoreTransactionRequest }
  | { error: string; payload: null };

export function parseChoreTransactionDraft({
  amount,
  childId,
  memo,
  type,
}: ChoreTransactionDraft): ChoreTransactionDraftResult {
  const amountCents = Math.round(Number.parseFloat(amount) * 100);
  if (
    !Number.isFinite(amountCents) ||
    amountCents === 0 ||
    (type !== "ADJUSTMENT" && amountCents < 0)
  ) {
    return {
      error:
        type === "ADJUSTMENT"
          ? "Enter a non-zero adjustment."
          : "Enter an amount greater than zero.",
      payload: null,
    };
  }

  return {
    error: null,
    payload: {
      child_id: childId,
      amount_cents: amountCents,
      type,
      memo,
    },
  };
}
