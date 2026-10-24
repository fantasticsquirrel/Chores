import { useState } from "react";
import {
  initialMagnetic,
  magneticResult,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { createMagneticFieldsScene } from "@family-manager/discovery-scenes/expansion/earth/magnets";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LandscapeInvestigation } from "../../landscape/LandscapeExhibit";
import { EarthExhibit, EarthMetric } from "./EarthExhibit";
export function MagneticFieldsSimulation() {
  const [state, setState] = useState<MagneticState>(initialMagnetic),
    result = magneticResult(state);
  const change = (key: "gap" | "probeX" | "probeZ") => (value: number) =>
    setState((s) => ({ ...s, [key]: value }));
  const direction = result.insideMagnet
    ? "Probe inside a bar"
    : result.direction === null
      ? "No preferred direction"
      : `${Math.round(result.direction)}° from +x`;
  const description = `The facing poles ${result.interaction}. Compass reading: ${direction}. Exterior field strength is ${result.strength.toFixed(2)} relative units. The north tip of each compass follows the combined local field.`;
  const select = (index: number) => {
    if (index === 1 || index === 2)
      setState((s) => ({ ...s, flipped: index === 1 }));
    if (index >= 10) {
      const i = index - 10;
      setState((s) => ({
        ...s,
        probeX: Math.round((-5.4 + (i % 7) * 1.8) * 10) / 10,
        probeZ: -2.9 + Math.floor(i / 7) * 2.9,
      }));
    }
  };
  return (
    <EarthExhibit
      question="Which way does a compass point between two magnets?"
      introduction="A compass’s north-seeking tip follows the combined magnetic field at its position. Outside a magnet, field direction goes from north toward south. Opposite facing poles attract; like facing poles repel. Moving the compass changes which local field it samples."
      scene={
        <ExpansionCanvas
          state={state}
          buildScene={createMagneticFieldsScene}
          description={description}
          onSelect={select}
        />
      }
      controls={
        <>
          <Slider
            label="Gap between bars · diagram units"
            value={state.gap}
            min={0.5}
            max={4.5}
            step={0.1}
            onChange={change("gap")}
          />
          <div className="earth-buttons">
            <button
              aria-pressed={state.flipped}
              onClick={() => setState((s) => ({ ...s, flipped: !s.flipped }))}
            >
              Flip right magnet
            </button>
            <button onClick={() => setState(initialMagnetic)}>
              Reset magnets and probe
            </button>
          </div>
          <Slider
            label="Compass x · diagram units"
            value={state.probeX}
            min={-6}
            max={6}
            step={0.1}
            onChange={change("probeX")}
          />
          <Slider
            label="Compass z · diagram units"
            value={state.probeZ}
            min={-4}
            max={4}
            step={0.1}
            onChange={change("probeZ")}
          />
          <p className="earth-control-note">
            Tap a small compass to sample its location. On the right bar, tap
            the left half to face north inward, or the right half to face south
            inward. The enlarged compass is your probe.
          </p>
        </>
      }
      evidence={
        <>
          <EarthMetric
            label="Facing-pole interaction"
            value={result.interaction}
          />
          <EarthMetric label="Compass north-tip direction" value={direction} />
          <EarthMetric
            label="Field strength · relative units"
            value={
              result.insideMagnet
                ? "Outside model domain"
                : result.strength.toFixed(2)
            }
          />
          <p>
            {result.insideMagnet
              ? "Move the probe outside either bar. This model calculates exterior fields only."
              : result.direction === null
                ? "The two contributions cancel here. A compass has no preferred orientation in this idealized zero field; Earth’s field and other nearby objects are omitted."
                : "The red north tip follows the vector sum of both fields, not simply the direction toward the nearest magnet."}
          </p>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Reverse one magnet",
              predict:
                "Will reversing only the right magnet change attraction to repulsion?",
              options: ["Interaction stays the same", "Interaction reverses"],
              action:
                "Reset to gap 2 and probe (0, 2). Compare the facing pole letters and force arrows before and after Flip right magnet. Keep gap and probe fixed.",
              explain:
                "Which pole pair faces across the gap in each case? How does the compass respond to the changed combined field?",
              test: () => setState(initialMagnetic),
              testLabel: "Set opposite facing poles",
            },
            {
              label: "Test cancellation",
              predict:
                "With two north poles facing, will the compass have a direction exactly halfway between them?",
              options: ["A definite direction", "Contributions cancel"],
              action:
                "Set up north poles facing with gap 2 and the probe at (0, 0). Note the direction result. Change only Compass z to 2 and compare.",
              explain:
                "Why can equal, opposing field contributions cancel at one point but not everywhere nearby? Does a weak field mean the magnets have stopped being magnets?",
              test: () =>
                setState({
                  ...initialMagnetic,
                  flipped: true,
                  probeX: 0,
                  probeZ: 0,
                }),
              testLabel: "Set midpoint between north poles",
            },
          ]}
        />
      }
      note="Positions and field strengths use diagram units, not metres or tesla. Identical magnets are represented by paired, softened pole sources for the exterior field; magnetic poles do not exist separately in this model or as known isolated magnetic charges. Lines show direction, not physical threads or particle tracks. Compass needles are ideal; friction and Earth’s field are omitted. At exact cancellation, no direction is drawn."
    />
  );
}
