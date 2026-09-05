import { act, renderHook, waitFor } from "@testing-library/react";

import { apiClient, type HouseholdModuleAccess } from "../../../api";
import { useHouseholdModules } from "./useHouseholdModules";

const choresModule: HouseholdModuleAccess = {
  key: "chores",
  name: "Chores",
  description: "Chore tracking",
  enabled: true,
  can_disable: true,
};

describe("useHouseholdModules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the household toggle and refreshes user and navigation access", async () => {
    vi.spyOn(apiClient, "listHouseholdModules").mockResolvedValue([
      choresModule,
    ]);
    const setHouseholdModule = vi
      .spyOn(apiClient, "setHouseholdModuleAccess")
      .mockResolvedValue({ ...choresModule, enabled: false });
    const refreshUsers = vi.fn();
    const refreshModuleAccess = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useHouseholdModules({ refreshModuleAccess, refreshUsers }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.toggleModule(choresModule));

    expect(setHouseholdModule).toHaveBeenCalledWith("chores", {
      enabled: false,
    });
    expect(refreshUsers).toHaveBeenCalledOnce();
    expect(refreshModuleAccess).toHaveBeenCalledOnce();
    expect(result.current.modules[0]?.enabled).toBe(false);
    expect(result.current.actionMessage).toBe(
      "Chores is now disabled for the whole household.",
    );
    expect(result.current.pendingKey).toBeNull();
  });
});
