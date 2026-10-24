import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { apiClient } from "./api";

describe("More navigation", () => {
  afterEach(() => vi.restoreAllMocks());
  it("closes after navigation and focuses the new page", async () => {
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/parent/children"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Children Management" });
    const summary = screen.getByText("More", { selector: "summary" });
    const details = summary.closest("details")!;
    details.open = true;
    fireEvent.click(screen.getByRole("link", { name: "Account in More menu" }));
    await waitFor(() => expect(details.open).toBe(false));
    expect(screen.getByRole("main")).toHaveFocus();
  });
  it("dismisses with Escape and returns focus to More", async () => {
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/parent/children"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Children Management" });
    const summary = screen.getByText("More", { selector: "summary" });
    const details = summary.closest("details")!;
    details.open = true;
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(summary).toHaveFocus();
  });
});
