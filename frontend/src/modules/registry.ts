import type { UserRole } from "../api";

export type FamilyModuleKey = "chores" | "homeschool" | "admin";

export type FamilyModule = {
  key: FamilyModuleKey;
  label: string;
  description: string;
  path: string;
  roles: UserRole[];
};

export const familyModules: FamilyModule[] = [
  {
    key: "chores",
    label: "Chores",
    description: "Chore assignments, submissions, approvals, and rewards.",
    path: "/parent/chores",
    roles: ["PARENT_ADMIN", "PARENT"],
  },
  {
    key: "homeschool",
    label: "Homeschool",
    description: "Attendance, subjects, semesters, comments, and homeschool reporting.",
    path: "/homeschool",
    roles: ["PARENT_ADMIN", "PARENT"],
  },
  {
    key: "admin",
    label: "Admin",
    description: "Household users, child accounts, and module access controls.",
    path: "/admin/dashboard",
    roles: ["PARENT_ADMIN"],
  },
];
