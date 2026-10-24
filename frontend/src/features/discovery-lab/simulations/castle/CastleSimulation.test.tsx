import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CastleSimulation } from "../CastleSimulation";
afterEach(cleanup);
describe("castle investigations", () => {
  it("keeps nonstructural sight guides off until requested and resets them off", () => {
    render(<CastleSimulation />);
    const overlay = screen.getByLabelText(
      "Sight-line overlay (not structures)",
    );
    expect(overlay).not.toBeChecked();
    fireEvent.click(overlay);
    expect(overlay).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Reset design" }));
    expect(overlay).not.toBeChecked();
  });
  it("provides one non-WebGL picture with a full route description", async () => {
    render(<CastleSimulation />);
    await screen.findByText(/3D view unavailable/);
    const scene = await screen.findByRole("img");
    expect(scene.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain(
      "blocked by closed gate",
    );
  });
  it("compares open-gate routes with the ditch held fixed", () => {
    render(<CastleSimulation />);
    fireEvent.click(screen.getByRole("button", { name: /^No$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Test open gate/ }));
    expect(screen.getByRole("status").textContent).toContain(
      "reaches outer entrance",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Compare north route/ }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "obstructed by ditch",
    );
    expect(
      (screen.getByLabelText("Ditch width") as HTMLInputElement).value,
    ).toBe("22");
    expect(screen.getByLabelText("Close gate")).not.toBeChecked();
  });
  it("changes only towers and the sight overlay in the sight-line comparison", () => {
    render(<CastleSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Compare sight lines" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Remove corner towers/ }),
    );
    expect(screen.getByLabelText("Projecting towers")).not.toBeChecked();
    expect(screen.getByLabelText("Close gate")).toBeChecked();
    expect(screen.getByRole("status").textContent).toContain(
      "blocked by closed gate",
    );
    fireEvent.click(screen.getByRole("button", { name: /Restore towers/ }));
    expect(screen.getByLabelText("Projecting towers")).toBeChecked();
  });
});
