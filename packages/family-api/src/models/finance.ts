export type ChoreTransactionType =
  | "CHORE_APPROVAL"
  | "BONUS"
  | "PAYMENT"
  | "ADJUSTMENT";

export interface ChildBalance {
  child_id: number;
  child_name: string;
  balance_cents: number;
}

export interface ChoreTransaction {
  id: number;
  child_id: number;
  amount_cents: number;
  type: ChoreTransactionType;
  memo: string;
  created_at: string;
}

export interface CreateChoreTransactionRequest {
  child_id: number;
  amount_cents: number;
  type: Exclude<ChoreTransactionType, "CHORE_APPROVAL">;
  memo?: string;
}
