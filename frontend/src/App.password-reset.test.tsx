import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";

describe("Password-reset routes and login entry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes recovery only for parent login and directs child users to a parent", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Child" }));
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
    expect(screen.getByText("Ask a parent to reset their password from the Parent sign-in screen.")).toBeVisible();
  });

  it("permits anonymous access to both recovery routes", async () => {
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Forgot Your Password?" })).toBeVisible();
  });

  it("shows a safe recovery fallback when the reset fragment is absent", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Reset Link Unavailable" })).toBeVisible();
  });

  it("uses non-affirmative guidance after a generic reset acknowledgement", async () => {
    render(
      <MemoryRouter initialEntries={["/login?passwordReset=1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Try signing in. If you cannot sign in, request a new reset link.")).toBeVisible();
    expect(screen.queryByText(/password has been updated/i)).toBeNull();
  });
});
