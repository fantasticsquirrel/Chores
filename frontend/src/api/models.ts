export type * from "@family-manager/family-api/models";
export type SupportTicket = {
  id: number;
  ticket_number: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  articles: Array<{ id?: number; body?: string; created_at?: string; sender?: string; type?: string }>;
};

export type CreateSupportTicketRequest = {
  title: string;
  body: string;
  category: "account" | "chores" | "homeschool" | "recipes" | "billing" | "bug" | "feature" | "other";
  idempotency_key: string;
  environment: string;
  app_version: string;
};
