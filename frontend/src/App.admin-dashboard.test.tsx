import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

const allModules = [
  { key: "chores" as const, name: "Chores", description: "Chores module" },
  {
    key: "homeschool" as const,
    name: "Homeschool",
    description: "Homeschool module",
  },
  { key: "admin" as const, name: "Admin", description: "Admin module" },
];

function mockAdminSession(): void {
  vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
    user: {
      id: 1,
      household_id: 1,
      email: "admin@example.com",
      role: "PARENT_ADMIN",
      child_id: null,
    },
    csrf_token: null,
  });
}

describe("Admin dashboard module access", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads household users and toggles module access", async () => {
    mockAdminSession();
    const listAccessSpy = vi
      .spyOn(apiClient, "listUserModuleAccess")
      .mockResolvedValue([
        {
          id: 1,
          household_id: 1,
          email: "admin@example.com",
          role: "PARENT_ADMIN",
          child_id: null,
          modules: allModules,
        },
        {
          id: 2,
          household_id: 1,
          email: "parent@example.com",
          role: "PARENT",
          child_id: null,
          modules: [allModules[0]],
        },
      ]);
    const setAccessSpy = vi
      .spyOn(apiClient, "setUserModuleAccess")
      .mockResolvedValue({
        id: 2,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
        modules: [allModules[0], allModules[1]],
      });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Admin Dashboard" }),
    ).toBeVisible();
    expect(await screen.findByText("parent@example.com")).toBeVisible();
    expect(listAccessSpy).toHaveBeenCalledTimes(1);

    const parentControls = screen.getByLabelText(
      "Module access for parent@example.com",
    );
    fireEvent.click(
      within(parentControls).getByRole("button", { name: "— Homeschool" }),
    );

    await waitFor(() =>
      expect(setAccessSpy).toHaveBeenCalledWith(2, {
        module_key: "homeschool",
        can_view: true,
        can_manage: false,
      }),
    );
    expect(
      await screen.findByText("parent@example.com can now access homeschool."),
    ).toBeVisible();
  });

  it("creates an additional parent login in the household", async () => {
    mockAdminSession();
    vi.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([
      {
        id: 1,
        household_id: 1,
        email: "admin@example.com",
        role: "PARENT_ADMIN",
        child_id: null,
        modules: allModules,
      },
    ]);
    const createParentSpy = vi
      .spyOn(apiClient, "createParentUser")
      .mockResolvedValue({
        id: 3,
        household_id: 1,
        email: "second.parent@example.com",
        role: "PARENT",
        child_id: null,
        modules: [allModules[0], allModules[1]],
      });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Admin Dashboard" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Second.Parent@Example.com " },
    });
    fireEvent.change(screen.getByLabelText("Temporary Password"), {
      target: { value: "password456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create Parent Login" }),
    );

    await waitFor(() =>
      expect(createParentSpy).toHaveBeenCalledWith({
        email: "second.parent@example.com",
        password: "password456",
        role: "PARENT",
      }),
    );
    expect(
      await screen.findByText(
        "Created parent login for second.parent@example.com.",
      ),
    ).toBeVisible();
    expect(screen.getByText("second.parent@example.com")).toBeVisible();
  });

  it("prevents disabling the only visible admin access in the UI", async () => {
    mockAdminSession();
    const setAccessSpy = vi.spyOn(apiClient, "setUserModuleAccess");
    vi.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([
      {
        id: 1,
        household_id: 1,
        email: "admin@example.com",
        role: "PARENT_ADMIN",
        child_id: null,
        modules: allModules,
      },
      {
        id: 2,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
        modules: [allModules[0], allModules[1]],
      },
    ]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    const adminControls = await screen.findByLabelText(
      "Module access for admin@example.com",
    );
    const adminButton = within(adminControls).getByRole("button", {
      name: "✓ Admin",
    });
    expect(adminButton).toBeDisabled();
    fireEvent.click(adminButton);

    expect(setAccessSpy).not.toHaveBeenCalled();
  });

  it("shows module access update errors without mutating the list", async () => {
    mockAdminSession();
    vi.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([
      {
        id: 2,
        household_id: 1,
        email: "parent@example.com",
        role: "PARENT",
        child_id: null,
        modules: [allModules[0]],
      },
    ]);
    vi.spyOn(apiClient, "setUserModuleAccess").mockRejectedValue(
      new ApiClientError(400, "Cannot remove the last admin module manager.", {
        detail: "Cannot remove the last admin module manager.",
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    const parentControls = await screen.findByLabelText(
      "Module access for parent@example.com",
    );
    fireEvent.click(
      within(parentControls).getByRole("button", { name: "— Homeschool" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update module access: Cannot remove the last admin module manager.",
    );
    expect(
      within(parentControls).getByRole("button", { name: "— Homeschool" }),
    ).toBeVisible();
  });
});
