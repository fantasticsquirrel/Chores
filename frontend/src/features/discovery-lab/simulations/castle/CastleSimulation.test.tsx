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
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
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
  it("requires a prediction, then reports controlled open-gate route evidence", () => {
    render(<CastleSimulation />);
    const compare = screen.getByRole("button", {
      name: "Compare open-gate routes",
    });
    expect(compare).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Bridge only" }));
    fireEvent.click(compare);
    expect(
      screen.getByTestId("castle-investigation-feedback"),
    ).toHaveTextContent("matches your prediction");
    expect(
      screen.getByTestId("castle-investigation-feedback"),
    ).toHaveTextContent(
      "Bridge: reaches outer entrance · North: stops at ditch",
    );
    expect(
      screen.getByTestId("castle-investigation-feedback"),
    ).toHaveTextContent("Changed: approach route");
    expect(screen.getByLabelText("Close gate")).not.toBeChecked();
  });
  it("compares tower sight lines with the route and ditch held fixed", () => {
    render(<CastleSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Compare sight lines" }),
    );
    const compare = screen.getByRole("button", {
      name: "Compare wall-side views",
    });
    expect(compare).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Projecting tower" }));
    fireEvent.click(compare);
    expect(
      screen.getByTestId("castle-investigation-feedback"),
    ).toHaveTextContent("matches your prediction");
    expect(
      screen.getByTestId("castle-investigation-feedback"),
    ).toHaveTextContent(
      "Flat wall: 1 illustrated direction · Projecting tower: 2",
    );
    expect(screen.getByLabelText("Projecting towers")).toBeChecked();
    expect(
      screen.getByLabelText("Sight-line overlay (not structures)"),
    ).toBeChecked();
  });

  it("resets predictions, comparison evidence and design state together", () => {
    render(<CastleSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Bridge only" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare open-gate routes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(
      screen.getByRole("button", { name: "Compare open-gate routes" }),
    ).toBeDisabled();
    expect(screen.queryByTestId("castle-investigation-feedback")).toBeNull();
    expect(screen.getByLabelText("Close gate")).toBeChecked();
  });
});
