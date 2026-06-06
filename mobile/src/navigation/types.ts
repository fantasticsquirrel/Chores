export type AppTab =
  | "home"
  | "children"
  | "chores"
  | "review"
  | "homeschool"
  | "admin"
  | "today"
  | "account";

export type TabDefinition = {
  key: AppTab;
  label: string;
};
