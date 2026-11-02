import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("native predictions and evidence", () => {
  it("gates sound comparisons behind predictions and records controlled evidence", () => {
    const view = render(<NativeExploration id="sound-playground" />);
    expect(
      view.getByText(/modeled midpoint displacement amplitude 3 mm/),
    ).toBeTruthy();
    expect(view.getByText(/no acoustic radiation is calculated/i)).toBeTruthy();
    expect(
      view.queryByText(
        /modeled pressure pattern|air pressure at one point|pressure trace/i,
      ),
    ).toBeNull();
    expect(view.getByText("Compare string lengths")).toBeDisabled();
    fireEvent.press(view.getByText("Half as many cycles per second"));
    fireEvent.press(view.getByText("Compare string lengths"));
    expect(
      view.getByText(
        /matches your prediction.*60 cm: 235.7 Hz.*120 cm: 117.9 Hz/,
      ),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Same number of cycles per second"));
    expect(
      view.queryByText(/matches your prediction.*60 cm: 235.7 Hz/),
    ).toBeNull();
    fireEvent.press(view.getByText("Half as many cycles per second"));
    fireEvent.press(view.getByText("Compare string lengths"));
    fireEvent.press(view.getByText("Same frequency"));
    fireEvent.press(view.getByText("Compare model amplitudes"));
    expect(
      view.getByText(
        /matches your prediction.*3 mm: 235.7 Hz.*6 mm: 235.7 Hz.*index 9 → 36/,
      ),
    ).toBeTruthy();
    expect(
      view.getByText(
        /Held: 60 cm length · 80 N tension · 1 g\/m linear density/,
      ),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Increase Slowed-motion phase"));
    expect(view.getByText("Slowed-motion phase: 1")).toBeTruthy();
    fireEvent.press(view.getByText("Show 3 mm evidence"));
    expect(view.getByText("Slowed-motion phase: 0")).toBeTruthy();
    fireEvent.press(view.getByText("Double frequency"));
    expect(
      view.queryByText(/matches your prediction.*3 mm: 235.7 Hz/),
    ).toBeNull();
    fireEvent.press(view.getByText("Same frequency"));
    fireEvent.press(view.getByText("Compare model amplitudes"));
    fireEvent.press(view.getByText("Increase String length (cm)"));
    expect(view.getByText(/Fundamental 202.0 Hz/)).toBeTruthy();
  });

  it("gates both bridge comparisons and keeps brace indices separate from beam results", () => {
    const view = render(<NativeExploration id="bridge-builder" />);
    expect(view.getByText("Compare load positions")).toBeDisabled();
    expect(view.getByText("Compare point loads")).toBeDisabled();
    fireEvent.press(view.getByText("Left support carries more"));
    fireEvent.press(view.getByText("Compare load positions"));
    expect(
      view.getByText(
        /matches your prediction.*Center: left 6.0 kN.*20%: left 9.6 kN.*Changed: load position.*Held: 12 kN point load/,
      ),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Moment and deflection both double"));
    fireEvent.press(view.getByText("Compare point loads"));
    expect(
      view.getByText(
        /matches your prediction.*8 kN: 20.0 kN·m and 1.67 mm.*16 kN: 40.0 kN·m and 3.33 mm/,
      ),
    ).toBeTruthy();
    expect(
      view.getByLabelText(
        /equivalent-beam profile uses one fixed 0 to 12\.5 millimeter display scale across every state/i,
      ),
    ).toBeTruthy();
    const beamSummary = view.getByText(
      /Left reaction 8.0 kN.*right reaction 8.0 kN.*peak moment 40.0 kN·m.*deflection at load 3.33 mm/,
    ).props.children;
    fireEvent.press(view.getByText("Add section 2 brace index modifier"));
    expect(
      view.getByText(
        /Left reaction 8.0 kN.*right reaction 8.0 kN.*peak moment 40.0 kN·m.*deflection at load 3.33 mm/,
      ).props.children,
    ).toEqual(beamSummary);
    expect(
      view.getByText(/invented comparison index.*not a capacity/i),
    ).toBeTruthy();
  });

  it("applies finite soil erosion and resets the river", () => {
    const view = render(<NativeExploration id="river-sculptor" />);
    fireEvent.press(view.getByText("Runoff and soil export both decrease"));
    fireEvent.press(view.getByText("Compare vegetation cover"));
    expect(view.getByText("Compare vegetation cover")).toBeDisabled();
    expect(
      view.getByText(/matches your prediction.*Bare: runoff 320.0 m³/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Only soil moved increases"));
    fireEvent.press(view.getByText("Compare catchment slopes"));
    expect(view.getByText("Compare catchment slopes")).toBeDisabled();
    expect(
      view.getByText(/matches your prediction.*2% slope: runoff 232.0 m³/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Restore soil"));
    fireEvent.press(view.getByText("Run one storm"));
    expect(
      view.getByText(/Storm 1.*4846.9 kg remaining.*5,000.0 kg/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Reset experiment"));
    expect(view.getByText("Compare vegetation cover")).toBeDisabled();
  });

  it("preserves independent parallel branches and opens the full series circuit", () => {
    const view = render(<NativeExploration id="circuit-city" />);
    expect(view.getByText("Compare series and parallel")).toBeDisabled();
    expect(view.getByText("Compare 6 V and 12 V")).toBeDisabled();
    fireEvent.press(
      view.getByText("All off in series; houses A and C on in parallel"),
    );
    fireEvent.press(view.getByText("Compare series and parallel"));
    expect(
      view.getByText(
        /matches your prediction.*Series, B open: 0\.00 A.*Parallel, B open: 2\.00 A/,
      ),
    ).toBeTruthy();
    fireEvent.press(
      view.getByText("Current doubles; power and energy quadruple"),
    );
    fireEvent.press(view.getByText("Compare 6 V and 12 V"));
    expect(
      view.getByText(
        /6 V: each house 0\.50 A.*3\.0 W.*30\.0 J.*12 V: each house 1\.00 A.*12\.0 W.*120\.0 J/,
      ),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Open house B switch"));
    expect(
      view.getByText(/Total current from the battery: 2.00 A/),
    ).toBeTruthy();
    expect(view.getByText("House A: 12.0 V · 1.00 A · 12.00 W")).toBeTruthy();
    expect(
      view.getByText(/20\.0 C leaves the source and 20\.0 C returns/),
    ).toBeTruthy();
    expect(
      view.getByText(/240\.0 J supplied = 240\.0 J transferred/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Series"));
    expect(
      view.getByText(/Total current from the battery: 0.00 A/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Close house B switch"));
    expect(
      view.getByText(/Total current from the battery: 0.33 A/),
    ).toBeTruthy();
    fireEvent.press(
      view.getByText("Increase Conventional-current marker phase (%)"),
    );
    expect(
      view.getByText("Conventional-current marker phase (%): 5"),
    ).toBeTruthy();
  });

  it("gates pond controls behind two fair comparisons and preserves absence", () => {
    const view = render(<NativeExploration id="food-web-rescue" />);
    expect(view.getByText("Compare fish present and absent")).toBeDisabled();
    expect(view.queryByText("Nutrient supply index: 50")).toBeNull();
    fireEvent.press(view.getByText("Zooplankton rises and algae falls"));
    fireEvent.press(view.getByText("Compare fish present and absent"));
    expect(
      view.getByText(/Fish absent: algae 10\.6.*zooplankton 56\.6/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Fish and oxygen both finish lower"));
    fireEvent.press(view.getByText("Compare low and high nutrients"));
    expect(
      view.getByText(/High nutrients: algae 40\.9.*oxygen 45\.7/),
    ).toBeTruthy();
    expect(view.getByText("Nutrient supply index: 100")).toBeTruthy();
    fireEvent.press(view.getByText("Remove fish"));
    fireEvent.press(view.getByText("Advance one week"));
    expect(view.getByText("Fish population index: 0.0")).toBeTruthy();
    expect(view.getByText(/Week 9\./)).toBeTruthy();
    fireEvent.press(view.getByText("Restore fish"));
    expect(view.getByText("Fish population index: 20.0")).toBeTruthy();
    fireEvent.press(view.getByText("Reset experiment"));
    expect(view.queryByText("Nutrient supply index: 50")).toBeNull();
  });

  it("splits every slice without changing the fraction and adds unlike denominators", () => {
    const view = render(<NativeExploration id="fraction-feast" />);
    fireEvent.press(view.getByText("Split every first-pizza slice in half"));
    expect(view.getByText(/First share: 4\/8 = 1\/2/)).toBeTruthy();
    expect(
      view.getByText(/The combined amount is exactly one whole pizza/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Decrease First selected slices"));
    expect(view.getByText(/3\/8 \+ 4\/8 = 7\/8 pizzas/)).toBeTruthy();
  });

  it("shows pentagon overlap and records distinct rotation and reflection", () => {
    const view = render(<NativeExploration id="pattern-palace" />);
    fireEvent.press(view.getByText("Pentagon"));
    expect(view.getByText(/overlap by 72°/)).toBeTruthy();
    fireEvent.press(view.getByText("Rotate a quarter turn"));
    fireEvent.press(view.getByText("Reflect motif"));
    expect(view.getByText(/Motif rotation: 90°. Reflection: on/)).toBeTruthy();
  });

  it("makes seasonal route and supply constraints matter", () => {
    const view = render(<NativeExploration id="caravan-crossroads" />);
    fireEvent.press(view.getByText("Wet season"));
    expect(
      view.getByText(/13 days of travel; 3 days short of supplies/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("River road"));
    expect(view.getByText(/8 days of travel; Enough supplies/)).toBeTruthy();
  });

  it("distinguishes visits, cross-species pollen and stepping-stone habitat", () => {
    const view = render(<NativeExploration id="pollinator-express" />);
    fireEvent.press(view.getByText("Visit Gold 1"));
    fireEvent.press(view.getByText("Visit Gold 1"));
    expect(
      view.getByText(/2 flower visits; 0 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Gold 2"));
    expect(
      view.getByText(/3 flower visits; 1 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Gold 3"));
    expect(view.getByText(/beyond the bee's flight reach/)).toBeTruthy();
    fireEvent.press(view.getByText("Add habitat patches"));
    fireEvent.press(view.getByText("Visit Gold bridge"));
    fireEvent.press(view.getByText("Visit Gold 3"));
    expect(
      view.getByText(/5 flower visits; 3 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Violet 2"));
    expect(
      view.getByText(/6 flower visits; 3 compatible pollen transfers/),
    ).toBeTruthy();
  });

  it("requires predictions and preserves the controlled chance comparison", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.1);
    const view = render(<NativeExploration id="chance-carnival" />);

    expect(view.getByText("Run 12 trials")).toBeDisabled();
    fireEvent.press(view.getByText("Counts can differ"));
    fireEvent.press(view.getByText("Run 12 trials"));
    expect(view.getByText(/Each fair draw is 25%/)).toBeTruthy();
    fireEvent.press(view.getByText("Run 1,200 trials"));
    expect(
      view.getByText(
        /12 trials: 100.0% · 0.0% · 0.0% · 0.0%.*Expected for both: 25% each/,
      ),
    ).toBeTruthy();
    expect(view.queryByText(/percentage points|\bpp\b|gap/i)).toBeNull();
    expect(view.getByText(/1,200 trials are not closer overall/)).toBeTruthy();

    expect(view.getByText("Run 200 trials")).toBeDisabled();
    fireEvent.press(view.getByText("40% (2 of 5)"));
    fireEvent.press(view.getByText("Run 200 trials"));
    expect(view.getByText(/Correct: 2\/5 = 40%/)).toBeTruthy();
    expect(view.getByText(/Outcome 1: 100.0% · expected 40%/)).toBeTruthy();
  });
});
