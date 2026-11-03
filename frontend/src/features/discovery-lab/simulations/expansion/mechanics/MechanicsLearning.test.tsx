import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MachineWorkshopSimulation,
  HeatHouseSimulation,
  PressureTankSimulation,
} from "./index";
vi.mock("../ExpansionCanvas", () => ({
  ExpansionCanvas: ({ description }: { description: string }) => (
    <div role="img" aria-label={description} />
  ),
}));
const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const change = (name: string, value: number) =>
  fireEvent.change(screen.getByRole("slider", { name }), {
    target: { value },
  });
const evidence = () =>
  screen.getByText("Recorded comparison:").closest(".mechanics-evidence");
describe("mechanics learning controls", () => {
  it("requires a prediction and compares force with distance for conserved work", () => {
    render(<MachineWorkshopSimulation />);
    expect(screen.getByRole("button", { name: "Set baseline" })).toBeDisabled();
    click("Less force, more rope");
    click("Set baseline");
    expect(
      screen.getByRole("slider", { name: "Supporting rope sections" }),
    ).toHaveValue("1");
    click("Use two sections");
    expect(evidence()).toHaveTextContent("392.4 N to 196.2 N");
    expect(evidence()).toHaveTextContent("0.5 m to 1.0 m");
    expect(evidence()).toHaveTextContent("supports your prediction");
    change("Load mass", 50);
    expect(screen.queryByText("Recorded comparison:")).not.toBeInTheDocument();
    click("Gear ratio");
    expect(screen.queryByText("Recorded comparison:")).not.toBeInTheDocument();
    click("More crank turns, less hand force");
    click("Set baseline");
    click("Use 48 driven teeth");
    expect(
      screen.getByRole("slider", { name: "Driven teeth ÷ driver teeth" }),
    ).toHaveValue("4");
    expect(evidence()).toHaveTextContent("78.48 to 19.62 N·m");
    expect(evidence()).toHaveTextContent("supports your prediction");
    click("Reset lesson");
    expect(
      screen.getByRole("slider", { name: "Supporting rope sections" }),
    ).toHaveValue("2");
    expect(screen.queryByText("Recorded comparison:")).not.toBeInTheDocument();
    click("Same force and rope");
    click("Set baseline");
    click("Use two sections");
    expect(evidence()).toHaveTextContent("does not support your prediction");
  });
  it("keeps lift replay opt-in and respects reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<MachineWorkshopSimulation />);
    click("Replay lift");
    expect(
      screen.getByText(
        "Reduced motion is on; the final lift position stays shown.",
      ),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("cancels a lift replay when another machine control changes", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", () => 17);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<MachineWorkshopSimulation />);
    click("Replay lift");
    expect(
      screen.getByRole("button", { name: "Replaying lift…" }),
    ).toBeDisabled();
    click("Gear winch");
    expect(screen.getByRole("button", { name: "Replay lift" })).toBeEnabled();
    expect(
      screen.queryByText(/Replaying the load movement/),
    ).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("cancels replay before guided baseline and after states with the same lift", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", () => 23);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<MachineWorkshopSimulation />);
    click("Replay lift");
    expect(
      screen.getByRole("button", { name: "Replaying lift…" }),
    ).toBeDisabled();
    click("Less force, more rope");
    click("Set baseline");
    expect(screen.getByRole("button", { name: "Replay lift" })).toBeEnabled();
    expect(
      screen.queryByText(/Replaying the load movement/),
    ).not.toBeInTheDocument();
    click("Use two sections");
    expect(evidence()).toHaveTextContent("supports your prediction");
    vi.unstubAllGlobals();
  });
  it("cancels replay when the document becomes hidden", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", () => 31);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<MachineWorkshopSimulation />);
    click("Replay lift");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: "Replay lift" })).toBeEnabled();
    expect(
      screen.queryByText(/Replaying the load movement/),
    ).not.toBeInTheDocument();
    hidden.mockRestore();
    vi.unstubAllGlobals();
  });
  it("compares insulation and window area under matched temperatures", () => {
    render(<HeatHouseSimulation />);
    expect(
      screen.queryByText(/Added insulation raises resistance only/),
    ).not.toBeInTheDocument();
    click("Window power stays the same");
    click("Set baseline");
    click("Add 10 cm insulation");
    expect(evidence()).toHaveTextContent("window power stays 448 W");
    expect(evidence()).toHaveTextContent("supports your prediction");
    expect(evidence()).toHaveTextContent("6 h");
    expect(evidence()).toHaveTextContent("kWh");
    expect(evidence()).toHaveTextContent("Changed: added wall insulation");
    expect(
      screen.getByText(/Added insulation raises resistance only/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Added insulation" }),
    ).toHaveValue("10");
    click("Window area");
    click("Combined power rises");
    click("Set baseline");
    click("Use 18 m² windows");
    expect(evidence()).toHaveTextContent("58 to 42 m²");
    expect(evidence()).toHaveTextContent("supports your prediction");
    expect(screen.getByRole("slider", { name: "Elapsed time" })).toHaveValue(
      "6",
    );
    change("Elapsed time", 12);
    expect(screen.getByText(/over 12 h/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Energy transferred over 12 h/i),
    ).toBeInTheDocument();
    change("Outdoor temperature", 20);
    expect(
      screen.getByText(/Equal indoor and outdoor temperatures/),
    ).toBeInTheDocument();
    change("Outdoor temperature", 25);
    expect(
      screen.getByText(/thermal energy transfers into the house/),
    ).toBeInTheDocument();
    click("Reset lesson");
    expect(screen.getByRole("slider", { name: "Elapsed time" })).toHaveValue(
      "6",
    );
    click("Window power falls");
    click("Set baseline");
    click("Add 10 cm insulation");
    expect(evidence()).toHaveTextContent("does not support your prediction");
  });

  it("keeps Heat House transfer replay opt-in and respects reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<HeatHouseSimulation />);
    click("Replay energy transfer");
    expect(
      screen.getByText(
        "Reduced motion is on; the final 6-hour energy total stays shown.",
      ),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("compares pressure by head and keeps shape out of instantaneous speed", () => {
    render(<PressureTankSimulation />);
    click("Pressure triples");
    click("Set baseline");
    click("Raise surface to 2 m");
    expect(evidence()).toHaveTextContent("0.5 to 1.5 m");
    click("Change tank shape");
    click("Same speed");
    click("Set baseline");
    click("Use the wide tank");
    expect(evidence()).toHaveTextContent("2,000 to 6,480 liters");
    change("Water surface height", 0.2);
    change("Outlet height above floor", 2.5);
    expect(screen.getByText(/The outlet is at or above/)).toBeInTheDocument();
    click("Reset tank");
    expect(
      screen.getByRole("slider", { name: "Water surface height" }),
    ).toHaveValue("2");
  });
});
