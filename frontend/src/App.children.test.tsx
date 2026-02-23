import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(await screen.findByText("Maya")).toBeVisible();
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

    await screen.findByText("Maya");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Leo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Child" }));

    await waitFor(() =>
      expect(createChildSpy).toHaveBeenCalledWith({
        household_id: 1,
        name: "Leo",
        active: true,
      }),
    );

    expect(await screen.findByText("Leo")).toBeVisible();
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

    await screen.findByText("Maya");
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

    await screen.findByText("Maya");
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

    await screen.findByText("Maya");
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
});
