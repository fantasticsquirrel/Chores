import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SoundPlaygroundSimulation } from "./SoundPlaygroundSimulation";
import { BridgeBuilderSimulation } from "./BridgeBuilderSimulation";
import { RiverSculptorSimulation } from "./RiverSculptorSimulation";
import { CircuitCitySimulation } from "./CircuitCitySimulation";
import { FoodWebSimulation } from "./FoodWebSimulation";
afterEach(cleanup);

describe("physical world exploration controls", () => {
  it.each([
    SoundPlaygroundSimulation,
    BridgeBuilderSimulation,
    RiverSculptorSimulation,
    CircuitCitySimulation,
    FoodWebSimulation,
  ])("renders a labeled exhibit and experiment prompt", (Simulation) => {
    render(<Simulation />);
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.getByText("Try this")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });
  it("changes pitch with length but not pluck amplitude", () => {
    render(<SoundPlaygroundSimulation />);
    const before = screen.getByLabelText("Frequency").textContent;
    fireEvent.change(screen.getByLabelText("Pluck amplitude"), {
      target: { value: 8 },
    });
    expect(screen.getByLabelText("Frequency").textContent).toBe(before);
    fireEvent.change(screen.getByLabelText("String length"), {
      target: { value: 120 },
    });
    expect(screen.getByLabelText("Frequency").textContent).not.toBe(before);
    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
  });
  it("adds and removes bracing with keyboard-accessible buttons", () => {
    render(<BridgeBuilderSimulation />);
    const before = screen.getByLabelText("Build cost").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Brace section 2" }));
    expect(
      screen.getByRole("button", { name: "Brace section 2", pressed: true }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Build cost").textContent).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Build cost").textContent).toBe(before);
  });
  it("erodes finite soil only when a storm is run and resets it", () => {
    render(<RiverSculptorSimulation />);
    const before = screen.getByLabelText("Soil remaining").textContent;
    fireEvent.change(screen.getByLabelText("Rainfall"), {
      target: { value: 100 },
    });
    expect(screen.getByLabelText("Soil remaining").textContent).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Run one storm" }));
    expect(screen.getByLabelText("Soil remaining").textContent).not.toBe(
      before,
    );
    expect(screen.getByText("Storm 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Soil remaining").textContent).toBe(before);
  });
  it("keeps other parallel houses on when one switch opens", () => {
    render(<CircuitCitySimulation />);
    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "parallel" },
    });
    fireEvent.click(screen.getByLabelText("House 2 switch"));
    expect(screen.getByLabelText("House 1 current").textContent).toBe("1.00 A");
    expect(screen.getByLabelText("House 2 current").textContent).toBe("0.00 A");
    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "series" },
    });
    expect(screen.getByLabelText("House 1 current").textContent).toBe("0.00 A");
  });
  it("steps the pond explicitly and holds removed species at zero", () => {
    render(<FoodWebSimulation />);
    fireEvent.click(screen.getByLabelText("Fish present"));
    fireEvent.click(screen.getByRole("button", { name: "Advance one week" }));
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "0.0",
    );
    expect(screen.getByText("Week 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "20.0",
    );
  });
});
