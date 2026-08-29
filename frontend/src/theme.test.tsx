import { fireEvent, render, screen } from "@testing-library/react";

import { ThemePicker, ThemeProvider } from "./theme";

describe("theme picker", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("switches and persists the selected visual system", () => {
    render(<ThemeProvider><ThemePicker /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Orbit Club/i }));
    expect(document.documentElement.dataset.theme).toBe("orbit-club");
    expect(localStorage.getItem("family-manager-theme")).toBe("orbit-club");
  });

  it("restores a valid stored theme", () => {
    localStorage.setItem("family-manager-theme", "clearline");
    render(<ThemeProvider><ThemePicker /></ThemeProvider>);
    expect(screen.getByRole("button", { name: /Clearline/i })).toHaveAttribute("aria-pressed", "true");
  });
});
