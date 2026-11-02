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
    [SoundPlaygroundSimulation, "Try this"],
    [BridgeBuilderSimulation, "Try this"],
    [RiverSculptorSimulation, "Try this"],
    [CircuitCitySimulation, "Units used in the evidence"],
    [FoodWebSimulation, "1 · Remove a consumer"],
  ] as const)(
    "renders a labeled exhibit and experiment prompt",
    (Simulation, prompt) => {
      render(<Simulation />);
      expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(prompt)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /^Reset(?: lesson)?$/ }),
      ).toBeTruthy();
    },
  );
  it("changes pitch with length but not pluck amplitude", () => {
    render(<SoundPlaygroundSimulation />);
    const before = screen.getByLabelText("Frequency").textContent;
    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare string lengths" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Same frequency" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare pluck amplitudes" }),
    );
    fireEvent.change(screen.getByLabelText("Model amplitude"), {
      target: { value: 8 },
    });
    expect(screen.getByLabelText("Frequency").textContent).toBe(before);
    fireEvent.change(screen.getByLabelText("String length"), {
      target: { value: 120 },
    });
    expect(screen.getByLabelText("Frequency").textContent).not.toBe(before);
    expect(
      screen.getByRole("button", { name: "Play slowed motion" }),
    ).toBeTruthy();
  });
  it("adds and removes bracing with keyboard-accessible buttons", () => {
    render(<BridgeBuilderSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Left support carries more" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare load positions" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Moment and deflection both double",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare point loads" }),
    );
    const before = screen.getByRole("button", {
      name: "Brace section 2",
    }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "Brace section 2" }));
    expect(
      screen.getByRole("button", { name: "Brace section 2", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Brace section 2" }).textContent,
    ).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(
      screen.queryByRole("button", { name: "Brace section 2" }),
    ).toBeNull();
  });
  it("erodes finite soil only when a storm is run and resets it", () => {
    render(<RiverSculptorSimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Runoff and soil export both decrease",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare vegetation cover" }),
    );
    expect(
      screen.getByRole("button", { name: "Compare vegetation cover" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Only soil moved increases" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare catchment slopes" }),
    );
    expect(
      screen.getByRole("button", { name: "Compare catchment slopes" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restore soil" }));
    const before = screen.getByLabelText("Soil remaining").textContent;
    fireEvent.change(screen.getByLabelText("Rainfall in one hour"), {
      target: { value: 100 },
    });
    expect(screen.getByLabelText("Soil remaining").textContent).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Run one storm" }));
    expect(screen.getByLabelText("Soil remaining").textContent).not.toBe(
      before,
    );
    expect(screen.getByText("Storm 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.getByLabelText("Soil remaining")).toHaveTextContent(
      "5000.0 kg",
    );
  });
  it("keeps other parallel houses on when one switch opens", () => {
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
      target: { value: "parallel" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "House 2 switch" }));
    expect(screen.getByLabelText("House 1 current").textContent).toBe("1.00 A");
    expect(screen.getByLabelText("House 2 current").textContent).toBe("0.00 A");
    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "series" },
    });
    expect(screen.getByLabelText("House 1 current").textContent).toBe("0.00 A");
  });
  it("steps the pond explicitly and holds removed species at zero", () => {
    render(<FoodWebSimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Zooplankton rises and algae falls",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare fish present and absent" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Fish and oxygen both finish lower" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare low and high nutrients" }),
    );
    fireEvent.click(screen.getByLabelText("Fish present"));
    fireEvent.click(screen.getByRole("button", { name: "Advance one week" }));
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "0.0",
    );
    expect(screen.getByText("Week 9")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "20.0",
    );
  });
});
