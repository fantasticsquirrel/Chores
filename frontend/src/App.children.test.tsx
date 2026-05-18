import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent children page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads children list for the household", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 1, household_id: 1, name: "Maya", active: true }]);

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    const childrenList = await screen.findByRole("list", { name: "Children list" });
    expect(within(childrenList).getByText("Maya")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 1 });
  });

  it("creates a child and refreshes the list", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy
      .mockResolvedValueOnce([{ id: 1, household_id: 1, name: "Maya", active: true }])
      .mockResolvedValueOnce([
        { id: 1, household_id: 1, name: "Maya", active: true },
        { id: 2, household_id: 1, name: "Leo", active: true },
      ]);
    const createChildSpy = vi.spyOn(apiClient, "createChild");
    createChildSpy.mockResolvedValue({ id: 2, household_id: 1, name: "Leo", active: true });

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("list", { name: "Children list" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Leo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Child" }));

    await waitFor(() =>
      expect(createChildSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Leo",
        active: true,
      }),
    );

    const childrenList = await screen.findByRole("list", { name: "Children list" });
    expect(within(childrenList).getByText("Leo")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledTimes(2);
  });

  it("toggles child active status and refreshes list", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy
      .mockResolvedValueOnce([{ id: 1, household_id: 1, name: "Maya", active: true }])
      .mockResolvedValueOnce([{ id: 1, household_id: 1, name: "Maya", active: false }]);
    const updateChildSpy = vi.spyOn(apiClient, "updateChild");
    updateChildSpy.mockResolvedValue({ id: 1, household_id: 1, name: "Maya", active: false });

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("list", { name: "Children list" });
    fireEvent.click(screen.getByRole("button", { name: "Set Inactive" }));

    await waitFor(() =>
      expect(updateChildSpy).toHaveBeenCalledWith(1, {
        household_id: 1,
        active: false,
      }),
    );

    expect(await screen.findByText("Inactive")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenCalledTimes(2);
  });

  it("shows an error message when creating a child fails", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 1, household_id: 1, name: "Maya", active: true }]);
    const createChildSpy = vi.spyOn(apiClient, "createChild");
    createChildSpy.mockRejectedValue(
      new ApiClientError(400, "Duplicate name", {
        detail: "Duplicate name",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("list", { name: "Children list" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Child" }));

    await waitFor(() =>
      expect(createChildSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Maya",
        active: true,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save child: Duplicate name");
    expect(listChildrenSpy).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when updating child status fails", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 1, household_id: 1, name: "Maya", active: true }]);
    const updateChildSpy = vi.spyOn(apiClient, "updateChild");
    updateChildSpy.mockRejectedValue(
      new ApiClientError(409, "Concurrent update conflict", {
        detail: "Concurrent update conflict",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("list", { name: "Children list" });
    fireEvent.click(screen.getByRole("button", { name: "Set Inactive" }));

    await waitFor(() =>
      expect(updateChildSpy).toHaveBeenCalledWith(1, {
        household_id: 1,
        active: false,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save child: Concurrent update conflict",
    );
    expect(listChildrenSpy).toHaveBeenCalledTimes(1);
  });

  it("uses authenticated household scope for list/create/update requests", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 22,
        household_id: 42,
        email: "parent42@example.com",
        role: "PARENT",
        child_id: null,
      },
      csrf_token: null,
    });

    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy
      .mockResolvedValueOnce([{ id: 5, household_id: 42, name: "Ari", active: true }])
      .mockResolvedValueOnce([
        { id: 5, household_id: 42, name: "Ari", active: true },
        { id: 8, household_id: 42, name: "Nova", active: true },
      ])
      .mockResolvedValueOnce([
        { id: 5, household_id: 42, name: "Ari", active: false },
        { id: 8, household_id: 42, name: "Nova", active: true },
      ]);
    const createChildSpy = vi.spyOn(apiClient, "createChild");
    createChildSpy.mockResolvedValue({ id: 8, household_id: 42, name: "Nova", active: true });
    const updateChildSpy = vi.spyOn(apiClient, "updateChild");
    updateChildSpy.mockResolvedValue({ id: 5, household_id: 42, name: "Ari", active: false });

    render(
      <MemoryRouter initialEntries={["/parent/children"]}>
        <App />
      </MemoryRouter>,
    );

    const childrenList = await screen.findByRole("list", { name: "Children list" });
    expect(within(childrenList).getByText("Ari")).toBeVisible();
    expect(listChildrenSpy).toHaveBeenNthCalledWith(1, { household_id: 42 });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Child" }));

    await waitFor(() =>
      expect(createChildSpy).toHaveBeenCalledWith({
        household_id: 42,
        name: "Nova",
        active: true,
      }),
    );

    const refreshedChildrenList = screen.getByRole("list", { name: "Children list" });
    const ariRow = within(refreshedChildrenList).getByText("Ari").closest("li");
    expect(ariRow).not.toBeNull();
    fireEvent.click(within(ariRow as HTMLLIElement).getByRole("button", { name: "Set Inactive" }));

    await waitFor(() =>
      expect(updateChildSpy).toHaveBeenCalledWith(5, {
        household_id: 42,
        active: false,
      }),
    );
  });
});
