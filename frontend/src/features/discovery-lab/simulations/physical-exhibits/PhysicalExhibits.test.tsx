import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeBuilderSimulation } from "../BridgeBuilderSimulation";
import { SoundPlaygroundSimulation } from "../SoundPlaygroundSimulation";
import { CircuitCitySimulation } from "../CircuitCitySimulation";
afterEach(cleanup);
describe("physical exhibits: direct investigation equivalents", () => {
  it("moves the bridge load without changing material or bracing", () => {
    render(<BridgeBuilderSimulation />);
    const cost = screen.getByLabelText("Build cost").textContent;
    fireEvent.click(
      screen.getByRole("button", { name: "Move load toward left bank" }),
    );
    expect(screen.getByLabelText("Load position")).toHaveValue("15");
    expect(screen.getByLabelText("Left support force")).toHaveTextContent(
      "8.5 kN",
    );
    expect(screen.getByLabelText("Right support force")).toHaveTextContent(
      "1.5 kN",
    );
    expect(screen.getByLabelText("Build cost").textContent).toBe(cost);
  });
  it("compares amplitude without changing natural frequency", () => {
    render(<SoundPlaygroundSimulation />);
    const frequency = screen.getByLabelText("Frequency").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Double amplitude" }));
    expect(screen.getByLabelText("Pluck amplitude")).toHaveValue("6");
    expect(screen.getByLabelText("Frequency").textContent).toBe(frequency);
    expect(
      screen.getByLabelText("Relative vibration energy"),
    ).toHaveTextContent("36");
    fireEvent.click(screen.getByRole("button", { name: "Double length" }));
    expect(screen.getByLabelText("String length")).toHaveValue("120");
    expect(screen.getByLabelText("Frequency").textContent).not.toBe(frequency);
  });
  it("toggles a house from its exhibit card with correct path behavior", () => {
    render(<CircuitCitySimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle House 2" }));
    expect(screen.getByLabelText("House 1 current")).toHaveTextContent(
      "0.00 A",
    );
    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "parallel" },
    });
    expect(screen.getByLabelText("House 1 current")).toHaveTextContent(
      "1.00 A",
    );
    expect(screen.getByLabelText("House 2 current")).toHaveTextContent(
      "0.00 A",
    );
    expect(screen.getByLabelText("House 3 current")).toHaveTextContent(
      "1.00 A",
    );
  });
});
