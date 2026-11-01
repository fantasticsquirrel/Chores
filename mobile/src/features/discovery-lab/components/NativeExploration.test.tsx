import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";
describe("native guided experiment controls", () => {
  it.each(["constructor", "__proto__", "toString"])(
    "guards inherited object name %s",
    (id) => {
      const view = render(<NativeExploration id={id} />);
      expect(view.getByRole("alert")).toBeTruthy();
    },
  );
  it("compares planetary diameters on a common linear scale", () => {
    const view = render(<NativeExploration id="solar-system" />);
    fireEvent.press(view.getByText("Compare planet diameters"));
    expect(
      view.getByText(/Equatorial diameter 12,756 km; 1.00 Earth diameters/),
    ).toBeTruthy();
    fireEvent.press(
      view.getByText("Increase Planet index (Mercury 0 to Neptune 7)"),
    );
    expect(
      view.getByText(/Equatorial diameter 6,792 km; 0.53 Earth diameters/),
    ).toBeTruthy();
  });
  it("does not substitute castle content for an unsupported Exploration", () => {
    const view = render(<NativeExploration id="future-topic" />);
    expect(view.getByRole("alert")).toHaveTextContent(
      "This Exploration's interactive model is not available in this app yet.",
    );
    expect(view.queryByText("Open gate")).toBeNull();
    expect(view.queryByText("Experiment bench")).toBeNull();
    view.rerender(<NativeExploration id="castle-defenses" />);
    expect(view.getByText("Open gate")).toBeTruthy();
    view.rerender(<NativeExploration id="future-topic" />);
    expect(view.queryByText("Open gate")).toBeNull();
  });
  it("runs both controlled orbit comparisons and resets", () => {
    const view = render(<NativeExploration id="orbital-mechanics" />);
    const compareSpeed = view.getByText("Compare 0.60×, 1.00× and 1.42×");
    expect(compareSpeed).toBeDisabled();
    fireEvent.press(view.getByText("Hit → orbit → escape"));
    fireEvent.press(compareSpeed);
    expect(view.getByText(/0.60× collision/)).toBeTruthy();
    expect(
      view.getByText(/gravity still acts along the escape path/),
    ).toBeTruthy();

    const compareMass = view.getByText("Compare 1× and 2× mass");
    expect(compareMass).toBeDisabled();
    fireEvent.press(view.getByText("Curves into a tighter ellipse"));
    fireEvent.press(compareMass);
    expect(view.getAllByText(/0.33–1.00 starting radii/)).toHaveLength(2);

    fireEvent.press(view.getByText("Reset experiment"));
    expect(compareSpeed).toBeDisabled();
  });
  it("runs both controlled optics comparisons and resets", () => {
    const view = render(<NativeExploration id="reflection-refraction" />);
    const criticalAction = view.getByText("Compare 40° and 43°");
    expect(criticalAction).toBeDisabled();
    fireEvent.press(view.getByText("Transmitted ray remains"));
    fireEvent.press(criticalAction);
    expect(view.getByText(/differs from your prediction/)).toBeTruthy();
    expect(view.getByText(/critical angle is 41.8°/)).toBeTruthy();
    fireEvent.press(view.getByText("Show 40° · refracted 74.6°"));
    expect(view.getByText(/incident 40.0°/)).toBeTruthy();

    const directionAction = view.getByText("Compare both directions");
    expect(directionAction).toBeDisabled();
    fireEvent.press(view.getByText("Toward in glass; away in air"));
    fireEvent.press(directionAction);
    expect(view.getByText(/Air → glass: 19.5°/)).toBeTruthy();
    expect(view.getByText(/Glass → air: 48.6°/)).toBeTruthy();
    fireEvent.press(view.getByText("Show air → glass · refracted 19.5°"));
    expect(view.getByText(/Air → Glass · incident 30.0°/)).toBeTruthy();

    fireEvent.press(view.getByText("Reset experiment"));
    expect(criticalAction).toBeDisabled();
  });
  it("runs both controlled gravity comparisons with evidence and resets", () => {
    const view = render(<NativeExploration id="gravity" />);
    const massAction = view.getByText("Compare 1 kg and 10 kg");
    const worldAction = view.getByText("Compare Earth and Moon");
    expect(massAction).toBeDisabled();
    expect(worldAction).toBeDisabled();

    fireEvent.press(view.getByText("10 kg lands first"));
    fireEvent.press(massAction);
    expect(view.getByText(/differs from your prediction/)).toBeTruthy();
    expect(view.getByText(/9.81 N.*98.1 N/)).toBeTruthy();

    fireEvent.press(view.getByText("Moon takes longer"));
    fireEvent.press(worldAction);
    expect(view.getByText(/matches your prediction/)).toBeTruthy();
    expect(view.getByText(/Earth 2.02 s.*Moon 4.97 s/)).toBeTruthy();

    fireEvent.press(view.getByText("Reset experiment"));
    expect(massAction).toBeDisabled();
    expect(worldAction).toBeDisabled();
  });
  it("opens the gate and explicitly reveals sight lines", () => {
    const view = render(<NativeExploration id="castle-defenses" />);
    fireEvent.press(view.getByText("Open gate"));
    expect(
      view.getByText(/Gate open: the direct entrance route remains/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Show sight-line overlay (not structures)"));
    expect(view.getByText(/Sight-line overlay shown/)).toBeTruthy();
  });
  it("calls the end of a full lunar cycle New Moon", () => {
    const view = render(<NativeExploration id="moon-phases" />);
    for (let i = 0; i < 18; i++)
      fireEvent.press(view.getByText("Increase Moon angle"));
    expect(view.getByText(/360° orbital angle; 0%.*New Moon/)).toBeTruthy();
  });
  it("runs the same controlled photosynthesis lesson and resets it", () => {
    const view = render(<NativeExploration id="photosynthesis" />);
    const runMissing = view.getByText("Compare light at zero water");
    expect(runMissing).toBeDisabled();
    fireEvent.press(view.getByText("More light restores activity"));
    fireEvent.press(runMissing);
    expect(view.getByText(/result differs from your prediction/)).toBeTruthy();
    fireEvent.press(view.getByText("Activity stays at zero"));
    fireEvent.press(runMissing);
    expect(view.getByText(/Water held at 0%/)).toBeTruthy();
    expect(view.getByText(/More light cannot replace water/)).toBeTruthy();

    const runSteps = view.getByText("Compare three light levels");
    expect(runSteps).toBeDisabled();
    fireEvent.press(view.getByText("Levels off once water limits"));
    fireEvent.press(runSteps);
    expect(view.getByText(/light and water tie/)).toBeTruthy();
    expect(
      view.getByText(/At 100% light, water limits this model/),
    ).toBeTruthy();
    expect(view.getByText("Increase Carbon dioxide")).toBeTruthy();

    fireEvent.press(view.getByText("Set comparison A"));
    fireEvent.press(view.getByText("Increase Water availability"));
    expect(
      view.getByText(
        /Changed: water 35% → 45%\. Held: light 100% · carbon dioxide 80%/,
      ),
    ).toBeTruthy();

    fireEvent.press(view.getByText("Reset experiment"));
    expect(view.getByText("Compare light at zero water")).toBeDisabled();
  });
});
