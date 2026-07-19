import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import type { HouseholdModuleAccess } from "../../api/models";
import { AdminScreen } from "./AdminScreen";

const householdModules: HouseholdModuleAccess[] = [
  {
    key: "chores",
    name: "Chores",
    description: "Chore assignments and rewards.",
    enabled: true,
    can_disable: true,
  },
  {
    key: "homeschool",
    name: "Homeschool",
    description: "School records and reporting.",
    enabled: false,
    can_disable: true,
  },
  {
    key: "admin",
    name: "Admin",
    description: "Household administration.",
    enabled: true,
    can_disable: false,
  },
];

function arrangeLoads() {
  jest.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([]);
  return jest
    .spyOn(apiClient, "listHouseholdModules")
    .mockResolvedValue(householdModules);
}

describe("AdminScreen household modules", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads household-wide module state and explains the locked admin module", async () => {
    arrangeLoads();

    render(<AdminScreen />);

    expect(screen.getByText("Loading household modules")).toBeTruthy();
    expect(await screen.findByText("Household Modules")).toBeTruthy();
    expect(screen.getByText("Chore assignments and rewards.")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Chores household access" }).props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    });
    expect(screen.getByRole("switch", { name: "Homeschool household access" }).props.accessibilityState).toMatchObject({
      checked: false,
      disabled: false,
    });
    expect(screen.getByRole("switch", { name: "Admin household access" }).props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });
    expect(screen.getByText("Admin stays enabled so household administrators cannot be locked out.")).toBeTruthy();
  });

  it("disables per-user controls while a module is globally off", async () => {
    jest.spyOn(apiClient, "listHouseholdModules").mockResolvedValue(householdModules);
    jest.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([
      {
        id: 2,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
        modules: [
          {
            key: "homeschool",
            name: "Homeschool",
            description: "School records and reporting.",
          },
        ],
      },
    ]);

    render(<AdminScreen />);

    const control = await screen.findByRole("button", {
      name: "Globally Off Homeschool",
    });
    expect(control.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("updates a toggle, announces success, and refreshes effective modules", async () => {
    arrangeLoads();
    const setAccess = jest
      .spyOn(apiClient, "setHouseholdModuleAccess")
      .mockResolvedValue({ ...householdModules[1], enabled: true });
    const onModulesChanged = jest.fn<() => Promise<void>>().mockResolvedValue();

    render(<AdminScreen onModulesChanged={onModulesChanged} />);
    const toggle = await screen.findByRole("switch", {
      name: "Homeschool household access",
    });

    fireEvent.press(toggle);

    await waitFor(() =>
      expect(setAccess).toHaveBeenCalledWith("homeschool", { enabled: true }),
    );
    await waitFor(() => expect(onModulesChanged).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Homeschool is now enabled for the household.")).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Homeschool household access" }).props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });
  });

  it("shows a household load error and retries only that section", async () => {
    jest.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([]);
    const listModules = jest
      .spyOn(apiClient, "listHouseholdModules")
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(householdModules);

    render(<AdminScreen />);

    expect(
      await screen.findByText(
        "Could not load household modules: network unavailable",
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry household modules" }));

    expect(await screen.findByText("Chore assignments and rewards.")).toBeTruthy();
    expect(listModules).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous state and exposes a retry when a toggle fails", async () => {
    arrangeLoads();
    const setAccess = jest
      .spyOn(apiClient, "setHouseholdModuleAccess")
      .mockRejectedValueOnce(new Error("save failed"))
      .mockResolvedValueOnce({ ...householdModules[1], enabled: true });

    render(<AdminScreen />);
    fireEvent.press(
      await screen.findByRole("switch", {
        name: "Homeschool household access",
      }),
    );

    expect(
      await screen.findByText("Could not update Homeschool: save failed"),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Homeschool household access" }).props
        .accessibilityState,
    ).toMatchObject({ checked: false, disabled: false });

    fireEvent.press(screen.getByRole("button", { name: "Retry Homeschool update" }));
    await waitFor(() => expect(setAccess).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Homeschool is now enabled for the household.")).toBeTruthy();
  });
});
