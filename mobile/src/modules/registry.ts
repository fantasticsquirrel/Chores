export type FamilyModuleKey = "chores" | "homeschool" | "admin";

export const familyModules: Array<{
  key: FamilyModuleKey;
  label: string;
  description: string;
  roles: string[];
}> = [
  {
    key: "chores",
    label: "Chores",
    description: "Household chore workflows and submission review.",
    roles: ["PARENT", "PARENT_ADMIN", "CHILD"],
  },
  {
    key: "homeschool",
    label: "Homeschool",
    description: "School records, attendance, comments, and grades.",
    roles: ["PARENT", "PARENT_ADMIN"],
  },
  {
    key: "admin",
    label: "Admin",
    description: "Parent users and module access.",
    roles: ["PARENT_ADMIN"],
  },
];
