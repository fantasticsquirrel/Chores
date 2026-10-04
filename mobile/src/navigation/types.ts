export type AppTab =
  | "home"
  | "children"
  | "chores"
  | "review"
  | "money"
  | "homeschool"
  | "recipes"
  | "notifications"
  | "admin"
  | "today"
  | "account";

export type NavigationItem = {
  key: AppTab;
  label: string;
};

export type PrimaryNavigationItem =
  | NavigationItem
  | {
      key: "more";
      label: "More";
    };

export type NavigationLayout = {
  primary: PrimaryNavigationItem[];
  overflow: NavigationItem[];
};
