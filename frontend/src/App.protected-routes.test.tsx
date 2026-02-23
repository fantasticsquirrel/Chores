import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("Protected routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects anonymous users to login for protected routes", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockRejectedValue(
      new ApiClientError(401, "Not authenticated.", { detail: "Not authenticated." }),
    );
    const listChildrenSpy = vi.spyOn(apiClient, "listChildren");
    listChildrenSpy.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/parent/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
    await waitFor(() => expect(listChildrenSpy).not.toHaveBeenCalled());
  });
});
