import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GravitySimulation } from "../GravitySimulation";
import { OrbitSimulation } from "../OrbitSimulation";
import { SolarSystemSimulation } from "../SolarSystemSimulation";
afterEach(cleanup);
describe("space learning controls", () => {
  it("changes weight but not fall time when mass changes", () => {
    render(<GravitySimulation />);
    expect(
      document.querySelector(".gravity-lane-readouts"),
    ).not.toHaveAttribute("aria-live");
    fireEvent.click(screen.getByText("Open controls"));
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
      target: { value: "moon" },
    });
    expect(screen.getByLabelText("Comparison fall time").textContent).not.toBe(
      time,
    );
    fireEvent.change(screen.getByLabelText("Drop height"), {
      target: { value: 50 },
    });
    expect(
      screen.getByRole("img", { name: /Distance fallen over time/ }),
    ).toHaveTextContent("50 m");
  });
  it("gates, explains and resets both gravity comparisons", () => {
    render(<GravitySimulation />);
    const massAction = screen.getByRole("button", {
      name: "Compare 1 kg and 10 kg",
    });
    const worldAction = screen.getByRole("button", {
      name: "Compare Earth and Moon",
    });
    expect(massAction).toBeDisabled();
    expect(worldAction).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "10 kg lands first" }));
    fireEvent.click(massAction);
    expect(screen.getByTestId("gravity-mass-feedback").textContent).toContain(
      "differs from your prediction",
    );
    expect(screen.getByTestId("gravity-mass-feedback").textContent).toContain(
      "9.81 N",
    );
    expect(screen.getByTestId("gravity-mass-feedback").textContent).toContain(
      "98.1 N",
    );

    fireEvent.click(screen.getByRole("button", { name: "Moon takes longer" }));
    fireEvent.click(worldAction);
    expect(screen.getByTestId("gravity-world-feedback").textContent).toContain(
      "matches your prediction",
    );
    expect(screen.getByTestId("gravity-world-feedback").textContent).toContain(
      "4.97 s",
    );
    expect(
      screen.getByRole("img", { name: /Moon · 5 kg lands in 4.97 seconds/ }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByTestId("gravity-mass-feedback")).toBeNull();
    expect(screen.queryByTestId("gravity-world-feedback")).toBeNull();
    expect(massAction).toBeDisabled();
    expect(worldAction).toBeDisabled();
  });
  it("scrubs the gravity evidence with keyboard controls", async () => {
    render(<GravitySimulation />);
    const scene = await screen.findByRole("img", {
      name: /Mass comparison in two vacuum-drop towers/,
    });
    const timeline = screen.getByLabelText("Drop timeline") as HTMLInputElement;
    fireEvent.keyDown(scene, { key: "End" });
    expect(timeline.value).toBe("100");
    fireEvent.keyDown(scene, { key: "Home" });
    expect(timeline.value).toBe("0");
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

    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByTestId("orbit-speed-evidence")).toBeNull();
    expect(screen.queryByTestId("orbit-mass-evidence")).toBeNull();
    expect(speedAction).toBeDisabled();
    expect(
      screen.getByText(/Planet radius is 0.22 of the starting radius/),
    ).toBeTruthy();
  });
  it("keeps motion controllable and diagnostic trace prose out of the primary scene", () => {
    render(<OrbitSimulation />);

    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restart flight" })).toBeTruthy();
    const timeline = screen.getByLabelText("Flight position");
    fireEvent.change(timeline, { target: { value: 62 } });
    expect((timeline as HTMLInputElement).value).toBe("62");
    fireEvent.click(screen.getByRole("button", { name: "Restart flight" }));
    expect((timeline as HTMLInputElement).value).toBe("0");
    expect(screen.queryByText(/finite displayed trace/i)).toBeNull();
    expect(
      screen.getByText("Gravity keeps curving the probe inward."),
    ).toBeTruthy();
  });
  it("gates both solar comparisons, reports evidence and resets", () => {
    render(<SolarSystemSimulation />);
    const orbitAction = screen.getByRole("button", {
      name: "Compare one Earth year",
    });
    const diameterAction = screen.getByRole("button", {
      name: "Compare Earth and Jupiter",
    });
    expect(orbitAction).toBeDisabled();
    expect(diameterAction).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Neptune" }));
    fireEvent.click(orbitAction);
    expect(screen.getByTestId("solar-orbit-feedback").textContent).toContain(
      "differs from your prediction",
    );
    expect(screen.getByTestId("solar-orbit-feedback").textContent).toContain(
      "0.006 orbit",
    );
    expect(
      (screen.getByLabelText("Model time") as HTMLInputElement).value,
    ).toBe("10");

    fireEvent.click(screen.getByRole("button", { name: "About 11×" }));
    fireEvent.click(diameterAction);
    expect(screen.getByTestId("solar-diameter-feedback").textContent).toContain(
      "matches your prediction",
    );
    expect(screen.getByTestId("solar-diameter-feedback").textContent).toContain(
      "11.21 Earth diameters",
    );
    expect(
      (screen.getByLabelText("Choose a planet") as HTMLSelectElement).value,
    ).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByTestId("solar-orbit-feedback")).toBeNull();
    expect(screen.queryByTestId("solar-diameter-feedback")).toBeNull();
    expect(orbitAction).toBeDisabled();
    expect(diameterAction).toBeDisabled();
  });

  it("keeps solar motion opt-in and keyboard-scrubbable", async () => {
    render(<SolarSystemSimulation />);
    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
    const scene = await screen.findByRole("img", {
      name: /Earth.*1 astronomical unit/i,
    });
    const timeline = screen.getByLabelText("Model time") as HTMLInputElement;
    fireEvent.keyDown(scene, { key: "End" });
    expect(timeline.value).toBe("100");
    fireEvent.keyDown(scene, { key: "Home" });
    expect(timeline.value).toBe("0");
  });
});
