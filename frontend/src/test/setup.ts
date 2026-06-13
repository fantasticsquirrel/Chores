import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

import { apiClient } from "../api";

beforeEach(() => {
  vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
    user: {
      id: 1,
      household_id: 1,
      email: "parent@example.com",
      role: "PARENT",
      child_id: null,
    },
    csrf_token: null,
  });
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [
      { key: "chores", name: "Chores", description: "" },
      { key: "homeschool", name: "Homeschool", description: "" },
      { key: "recipes", name: "Recipes", description: "" },
      { key: "admin", name: "Admin", description: "" },
    ],
  });
});
