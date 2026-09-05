import { act, renderHook, waitFor } from "@testing-library/react";

import { apiClient, type UserModuleAccess } from "../../../api";
import { useAdminUsers } from "./useAdminUsers";

const existingUser: UserModuleAccess = {
  id: 1,
  household_id: 7,
  email: "zara@example.com",
  role: "PARENT_ADMIN",
  child_id: null,
  modules: [],
};

describe("useAdminUsers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a parent login, updates the sorted users, and resets the form", async () => {
    vi.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([
      existingUser,
    ]);
    const createParent = vi
      .spyOn(apiClient, "createParentUser")
      .mockResolvedValue({
        ...existingUser,
        id: 2,
        email: "amy@example.com",
        role: "PARENT",
      });
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setNewParentEmail("  Amy@Example.com ");
      result.current.setNewParentPassword("password456");
      result.current.setNewParentRole("PARENT");
    });
    await act(async () => result.current.createParent());

    expect(createParent).toHaveBeenCalledWith({
      email: "amy@example.com",
      password: "password456",
      role: "PARENT",
    });
    expect(result.current.users.map((user) => user.email)).toEqual([
      "amy@example.com",
      "zara@example.com",
    ]);
    expect(result.current.newParentEmail).toBe("");
    expect(result.current.newParentPassword).toBe("");
    expect(result.current.actionMessage).toBe(
      "Created parent login for amy@example.com.",
    );
  });

  it("validates the existing password policy before calling the API", async () => {
    vi.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([]);
    const createParent = vi.spyOn(apiClient, "createParentUser");
    const { result } = renderHook(() => useAdminUsers());

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setNewParentEmail("parent@example.com");
      result.current.setNewParentPassword("short");
    });
    await act(async () => result.current.createParent());

    expect(result.current.actionError).toBe(
      "Parent password must be at least 8 characters.",
    );
    expect(createParent).not.toHaveBeenCalled();
  });
});
