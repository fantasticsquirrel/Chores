import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GravitySimulation } from "../GravitySimulation";
import { OrbitSimulation } from "../OrbitSimulation";
import { SolarSystemSimulation } from "../SolarSystemSimulation";
afterEach(cleanup);
describe("space learning controls", () => {
  it("changes weight but not fall time when mass changes", () => {
    render(<GravitySimulation />);
    const time = screen.getByLabelText("Comparison fall time").textContent;
    const weight = screen.getByLabelText("Comparison weight").textContent;
    fireEvent.change(screen.getByLabelText("Comparison object mass"), {
      target: { value: 20 },
    });
    expect(screen.getByLabelText("Comparison fall time").textContent).toBe(
      time,
    );
    expect(screen.getByLabelText("Comparison weight").textContent).not.toBe(
      weight,
    );
    fireEvent.change(screen.getByLabelText("Comparison world"), {
      target: { value: 1 },
    });
    expect(screen.getByLabelText("Comparison fall time").textContent).not.toBe(
      time,
    );
  });
  it("gives observed evidence for a fair mass comparison", () => {
    render(<GravitySimulation />);
    fireEvent.click(screen.getByRole("button", { name: /^Same time$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare 1 kg with 10 kg" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "same acceleration",
    );
    expect(
      (screen.getByLabelText("Comparison world") as HTMLSelectElement).value,
    ).toBe("0");
    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
  });
  it("runs both controlled orbit comparisons and resets their evidence", () => {
    render(<OrbitSimulation />);
    const speedAction = screen.getByRole("button", {
      name: "Compare 0.60×, 1.00× and 1.42×",
    });
    const massAction = screen.getByRole("button", {
      name: "Compare 1× and 2× mass",
    });
    expect(speedAction).toBeDisabled();
    expect(massAction).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Hit → orbit → escape",
      }),
    );
    fireEvent.click(speedAction);
    expect(screen.getByTestId("orbit-speed-evidence").textContent).toContain(
      "0.60× collision",
    );
    expect(screen.getByTestId("orbit-speed-evidence").textContent).toContain(
      "1.42× escape",
    );
    expect(massAction).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Curves into a tighter ellipse",
      }),
    );
    fireEvent.click(massAction);
    expect(screen.getByTestId("orbit-mass-evidence").textContent).toContain(
      "Displayed trace: 0.33–1.00 starting radii",
    );
    expect(screen.getByTestId("orbit-mass-feedback").textContent).toContain(
      "same 1.00× launch",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByTestId("orbit-speed-evidence")).toBeNull();
    expect(screen.queryByTestId("orbit-mass-evidence")).toBeNull();
    expect(speedAction).toBeDisabled();
    expect(
      screen.getByText(/Planet radius is 0.22 of the starting radius/),
    ).toBeTruthy();
  });
  it("selects eight planets with buttons and preserves one diameter scale", () => {
    render(<SolarSystemSimulation />);
    expect(screen.getAllByRole("option")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Jupiter 5" }));
    expect(
      (screen.getByLabelText("Choose a planet") as HTMLSelectElement).value,
    ).toBe("4");
    fireEvent.change(screen.getByLabelText("View"), {
      target: { value: "sizes" },
    });
    expect(screen.getByText("11.21")).toBeTruthy();
    expect(
      screen.getByText(/Diameter view uses one scale for both globes/),
    ).toBeTruthy();
  });
  it("tests unequal orbital periods at the same model time", () => {
    render(<SolarSystemSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Advance one Earth year" }),
    );
    expect(screen.getByRole("status").textContent).toContain("1/165");
    expect(
      (screen.getByLabelText("Model time") as HTMLInputElement).value,
    ).toBe("10");
    expect(
      (screen.getByLabelText("Choose a planet") as HTMLSelectElement).value,
    ).toBe("7");
  });
});
