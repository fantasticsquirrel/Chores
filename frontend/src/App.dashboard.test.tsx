import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Parent dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders child balance rows and quick actions", async () => {
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([{ id: 1, household_id: 1, name: "Maya", active: true }]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading child balances...")).toBeVisible();
    expect(await screen.findByText("Maya")).toBeVisible();
    expect(screen.getByRole("link", { name: "Manage Children" })).toHaveAttribute("href", "/parent/children");
    expect(screen.getByRole("link", { name: "Open Board" })).toHaveAttribute("href", "/board");
    expect(listChildrenSpy).toHaveBeenCalledWith({ household_id: 1 });
  });

  it("shows an error message when children loading fails", async () => {
    vi.spyOn(apiClient, "listChildren").mockRejectedValue(
      new ApiClientError(503, "Backend unavailable", {
        detail: "Backend unavailable",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load children: Backend unavailable");
  });
});
