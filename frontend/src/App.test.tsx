import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { ApiClientError, apiClient } from "./api";

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getCurrentSession").mockRejectedValue(
      new ApiClientError(401, "Not authenticated.", { detail: "Not authenticated." }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the routed shell and login route", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Parent Dashboard" })).not.toBeInTheDocument();
  });

  it("redirects root path to login", async () => {
    render(
      <MemoryRouter initialEntries={["/"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
  });
});
