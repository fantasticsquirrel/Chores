import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ORBIT_MASS_COMPARISON,
  orbitActivity,
} from "@family-manager/family-api/discovery-models/orbit";
import { OrbitComparisonPlot, OrbitPathDiagram } from "./OrbitPathDiagram";

afterEach(cleanup);

describe("OrbitPathDiagram", () => {
  it("describes launch speed and a finite displayed trace without a false frame claim", () => {
    render(
      <OrbitPathDiagram
        result={orbitActivity({ speed: 1.42, mass: 1 })}
        progress={1}
      />,
    );

    expect(screen.getByText("Circular launch speed at start")).toBeTruthy();
    expect(screen.queryByText("Circular speed here")).toBeNull();
    expect(screen.queryByText(/leaves the frame/i)).toBeNull();
    expect(
      screen.getByText(/without returning before the model's cutoff/),
    ).toBeTruthy();
    expect(screen.getByText("starting radius reference")).toBeTruthy();
  });

  it("draws the final motion arrow along the nonzero incoming tangent", () => {
    const result = orbitActivity({ speed: 1, mass: 2 });
    render(<OrbitPathDiagram result={result} progress={1} />);
    const vector = screen.getByTestId("orbit-motion-vector");
    const x1 = Number(vector.getAttribute("x1"));
    const y1 = Number(vector.getAttribute("y1"));
    const x2 = Number(vector.getAttribute("x2"));
    const y2 = Number(vector.getAttribute("y2"));
    const last = result.points.at(-1)!;
    const previous = result.points.at(-2)!;
    const incoming = { x: last.x - previous.x, y: -last.y + previous.y };
    const arrow = { x: x2 - x1, y: y2 - y1 };

    expect(Math.hypot(arrow.x, arrow.y)).toBeCloseTo(0.25, 8);
    expect(arrow.x * incoming.y - arrow.y * incoming.x).toBeCloseTo(0, 8);
    expect(arrow.x * incoming.x + arrow.y * incoming.y).toBeGreaterThan(0);
  });

  it("labels comparison intervals as ranges of the displayed finite trace", () => {
    render(<OrbitComparisonPlot trials={ORBIT_MASS_COMPARISON} />);
    expect(screen.getAllByText(/^Displayed trace:/)).toHaveLength(2);
    expect(
      screen.getByText("Displayed trace: 0.33–1.00 starting radii"),
    ).toBeTruthy();
  });
});
