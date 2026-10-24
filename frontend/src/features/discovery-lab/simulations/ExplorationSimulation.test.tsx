import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplorationSimulation } from "./ExplorationSimulation";
afterEach(cleanup);
describe("interactive exploration controls", () => {
  it.each(["constructor", "toString", "__proto__", "missing"])(
    "rejects unknown renderer %s",
    (id) => {
      render(<ExplorationSimulation explorationId={id} />);
      expect(
        screen.getByText(
          "This exploration's interactive model is not available.",
        ),
      ).toBeTruthy();
    },
  );
  it.each([
    "orbital-mechanics",
    "reflection-refraction",
    "gravity",
    "solar-system",
    "moon-phases",
    "photosynthesis",
    "castle-defenses",
  ])("renders an accessible scene for %s", async (id) => {
    render(<ExplorationSimulation explorationId={id} />);
    expect(await screen.findByRole("img")).toBeTruthy();
    if (id === "moon-phases")
      expect(screen.getByText("01 / PREDICT")).toBeTruthy();
    else if (id === "castle-defenses")
      expect(screen.getByText("1. Predict")).toBeTruthy();
    else expect(screen.getByText("Try this")).toBeTruthy();
  });
  it("changes orbit physics with launch speed and central mass", () => {
    render(<ExplorationSimulation explorationId="orbital-mechanics" />);
    fireEvent.change(screen.getByLabelText("Launch speed"), {
      target: { value: 1.6 },
    });
    expect(screen.getByText("escape path")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Central mass"), {
      target: { value: 2 },
    });
    expect(screen.getByText("bound orbit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      (screen.getByLabelText("Launch speed") as HTMLInputElement).value,
    ).toBe("1");
  });
  it("computes total internal reflection when materials are swapped", () => {
    render(<ExplorationSimulation explorationId="reflection-refraction" />);
    fireEvent.click(screen.getByRole("button", { name: "Swap materials" }));
    fireEvent.change(screen.getByLabelText("Incident angle"), {
      target: { value: 60 },
    });
    expect(screen.getByText("Total internal reflection")).toBeTruthy();
  });
  it("allows direct keyboard-friendly phase selection", () => {
    render(<ExplorationSimulation explorationId="moon-phases" />);
    fireEvent.click(screen.getByRole("button", { name: "Full" }));
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("0%")).toBeTruthy();
  });
  it("models a missing resource rather than linear light growth", () => {
    render(<ExplorationSimulation explorationId="photosynthesis" />);
    fireEvent.change(screen.getByLabelText("Water availability"), {
      target: { value: 0 },
    });
    expect(screen.getByText("0 / 100")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Light availability"), {
      target: { value: 100 },
    });
    expect(screen.getByText("0 / 100")).toBeTruthy();
  });
  it("changes the route when the gate opens", () => {
    render(<ExplorationSimulation explorationId="castle-defenses" />);
    expect(screen.getByText("blocked by closed gate")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close gate"));
    expect(screen.getByText("reaches outer entrance")).toBeTruthy();
  });
  it("starts every moving scene paused", () => {
    render(<ExplorationSimulation explorationId="gravity" />);
    expect(screen.getByRole("button", { name: "Play motion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause motion" })).toBeNull();
  });
  it("does not imply a north wall becomes an entrance when the ditch is removed", () => {
    render(<ExplorationSimulation explorationId="castle-defenses" />);
    fireEvent.change(screen.getByLabelText("Approach route"), {
      target: { value: "north" },
    });
    fireEvent.change(screen.getByLabelText("Ditch width"), {
      target: { value: 0 },
    });
    expect(screen.getByText("reaches solid outer wall")).toBeTruthy();
  });
  it("selects only the current exact Moon phase preset", () => {
    render(<ExplorationSimulation explorationId="moon-phases" />);
    fireEvent.click(screen.getByRole("button", { name: /^New$/ }));
    const initial = screen.getByRole("button", { name: "New", pressed: true });
    fireEvent.click(screen.getByRole("button", { name: "Quarter" }));
    expect(initial.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Quarter", pressed: true }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Orbit position"), {
      target: { value: 135 },
    });
    expect(screen.queryByRole("button", { pressed: true })).toBeNull();
  });
});
