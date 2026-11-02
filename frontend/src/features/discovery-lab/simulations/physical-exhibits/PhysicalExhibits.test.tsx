import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeBuilderSimulation } from "../BridgeBuilderSimulation";
import { SoundPlaygroundSimulation } from "../SoundPlaygroundSimulation";
import { CircuitCitySimulation } from "../CircuitCitySimulation";
afterEach(cleanup);
describe("physical exhibits: direct investigation equivalents", () => {
  it("moves the bridge load through a controlled comparison", () => {
    render(<BridgeBuilderSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Left support carries more" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare load positions" }),
    );
    expect(screen.getByLabelText("Left support force")).toHaveTextContent(
      "9.6 kN",
    );
    expect(screen.getByLabelText("Right support force")).toHaveTextContent(
      "2.4 kN",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "Changed: load position",
    );
  });
  it("compares amplitude without changing natural frequency", () => {
    render(<SoundPlaygroundSimulation />);
    const frequency = screen.getByLabelText("Frequency").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Same frequency" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare pluck amplitudes" }),
    );
    expect(screen.getByLabelText("Frequency").textContent).toBe(frequency);
    expect(screen.getByLabelText("Relative vibration index")).toHaveTextContent(
      "36",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare string lengths" }),
    );
    expect(screen.getByLabelText("Frequency").textContent).not.toBe(frequency);
  });
  it("toggles a house from its exhibit card with correct path behavior", () => {
    render(<CircuitCitySimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "All off in series; houses 1 and 3 on in parallel",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare series and parallel" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Current doubles; power and energy quadruple",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare 6 V and 12 V" }),
    );
    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "series" },
    });
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
