import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

describe("App", () => {
  it("renders the routed shell and login route", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Parent Dashboard" })).not.toBeInTheDocument();
  });

  it("redirects root path to login", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeVisible();
  });
});
