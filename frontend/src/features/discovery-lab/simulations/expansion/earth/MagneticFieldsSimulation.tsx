import { useState } from "react";
import {
  defaultMagneticState,
  magneticFieldsBoundary,
  magneticFieldsCoreBoundary,
  magneticResult,
  normalizeMagnetic,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/magnetic-fields";
import { createMagneticFieldsScene } from "@family-manager/discovery-scenes/expansion/earth/magnets";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { MagneticFieldsComparison } from "./MagneticFieldsComparison";
import { useCompassAlignmentReplay } from "./useCompassAlignmentReplay";
import "../mechanics/mechanics.css";
import "./magnetic-fields.css";

function fieldIndex(result: ReturnType<typeof magneticResult>) {
  return result.relativeFieldIndex === null
    ? "outside model"
    : `${result.relativeFieldIndex} / 100`;
}

export function MagneticFieldsSimulation() {
  const [state, setState] = useState<MagneticState>({
    ...defaultMagneticState,
  });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const replay = useCompassAlignmentReplay(
    `${state.gap}:${state.flipped}:${state.probeX}:${state.probeZ}`,
  );
  const visualState = { ...state, alignmentProgress: replay.alignmentProgress };
  const result = magneticResult(state);

  const update = (next: MagneticState) => {
    replay.cancel();
    setState(normalizeMagnetic(next));
    setComparisonVersion((value) => value + 1);
  };
  const applyGuidedState = (next: MagneticState) => {
    replay.cancel();
    setState(normalizeMagnetic(next));
  };
  const reset = () => update({ ...defaultMagneticState });
  const description =
    `Two dimensional bar magnets on a marked tabletop. Facing ${result.facingPoles} poles ${result.interaction}. ` +
    (result.insideMagnet
      ? "The enlarged probe is inside a bar, outside this exterior-field model's domain. "
      : result.directionDegrees === null
        ? `At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), equal opposing contributions give a 0 normalized field index and no preferred compass direction. `
        : `At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), the north-seeking end points ${result.directionLabel}; normalized field index ${result.relativeFieldIndex} out of 100. `) +
    `Left and right source-contribution indices are ${result.leftContributionIndex} and ${result.rightContributionIndex}. ` +
    "Pole letters, force-direction arrows, compass needles and text labels provide noncolor evidence. Exterior line arrows run from north toward south and represent field direction, not physical threads or particle paths.";

  const select = (index: number) => {
    if (index === 1 || index === 2) {
      update({ ...state, flipped: index === 1 });
      return;
    }
    if (index >= 10) {
      const compassIndex = index - 10;
      update({
        ...state,
        probeX: Math.round((-5.4 + (compassIndex % 7) * 1.8) * 10) / 10,
        probeZ: -2.9 + Math.floor(compassIndex / 7) * 2.9,
      });
    }
  };

  return (
    <section className="magnet-exhibit">
      <header className="magnet-heading">
        <h2>How do two magnets set a compass direction?</h2>
        <p>
          Predict first. Reverse one bar to compare facing poles, then move one
          probe away from an exact cancellation point while every magnet stays
          fixed.
        </p>
      </header>
      <ExpansionCanvas
        state={visualState}
        buildScene={createMagneticFieldsScene}
        description={description}
        onSelect={select}
      />
      <div className="magnet-motion-toolbar">
        <button type="button" disabled={replay.running} onClick={replay.replay}>
          {replay.running
            ? "Replaying compass alignment…"
            : "Replay compass alignment"}
        </button>
        {replay.status && (
          <p className="magnet-motion-status" role="status">
            {replay.status}
          </p>
        )}
      </div>
      <div className="magnet-console">
        <div className="magnet-inputs">
          <Slider
            label="Gap between bars"
            value={state.gap}
            min={0.5}
            max={4.5}
            step={0.1}
            unit=" diagram units"
            onChange={(gap) => update({ ...state, gap })}
          />
          <div>
            <strong>Right magnet orientation</strong>
            <div
              className="magnet-orientation"
              role="group"
              aria-label="Right magnet orientation"
            >
              <button
                type="button"
                aria-pressed={!state.flipped}
                onClick={() => update({ ...state, flipped: false })}
              >
                N–S facing
              </button>
              <button
                type="button"
                aria-pressed={state.flipped}
                onClick={() => update({ ...state, flipped: true })}
              >
                N–N facing
              </button>
            </div>
          </div>
          <Slider
            label="Compass x position"
            value={state.probeX}
            min={-6}
            max={6}
            step={0.1}
            unit=" diagram units"
            onChange={(probeX) => update({ ...state, probeX })}
          />
          <Slider
            label="Compass z position"
            value={state.probeZ}
            min={-4}
            max={4}
            step={0.1}
            unit=" diagram units"
            onChange={(probeZ) => update({ ...state, probeZ })}
          />
          <p className="magnet-control-note">
            Tap a small compass to sample that location. The enlarged compass is
            the probe. Pole letters and arrowheads carry the meaning without
            relying on red or blue.
          </p>
          <button className="magnet-reset" type="button" onClick={reset}>
            Reset lesson
          </button>
        </div>
        <div className="magnet-results" aria-live="polite" aria-atomic="true">
          <div className="magnet-measures">
            <div>
              <span>Facing poles</span>
              <strong>{result.facingPoles}</strong>
            </div>
            <div>
              <span>Interaction</span>
              <strong>{result.interaction}</strong>
            </div>
            <div>
              <span>North-seeking end</span>
              <strong className="magnet-direction">
                {result.directionLabel}
              </strong>
            </div>
            <div>
              <span>Normalized field index</span>
              <strong>{fieldIndex(result)}</strong>
            </div>
            <div>
              <span>Left-bar contribution</span>
              <strong>{result.leftContributionIndex} / 100</strong>
            </div>
            <div>
              <span>Right-bar contribution</span>
              <strong>{result.rightContributionIndex} / 100</strong>
            </div>
          </div>
          <div
            className="magnet-vector-sum"
            aria-label="The left bar field vector plus the right bar field vector gives the combined local field followed by the compass north-seeking end."
          >
            <span>left field vector</span>
            <b aria-hidden="true">+</b>
            <span>right field vector</span>
            <b aria-hidden="true">→</b>
            <span>combined local field</span>
          </div>
          <h3>
            {result.insideMagnet
              ? "Move the probe outside either bar."
              : result.directionDegrees === null
                ? "Equal and opposite here: the vector sum is zero."
                : `The north-seeking end points ${result.directionLabel}.`}
          </h3>
          <p>
            A compass is a small magnet. Its north-seeking end aligns with the
            combined local magnetic field. Outside a bar magnet, conventional
            field direction runs from its north pole toward its south pole.
          </p>
          <p>
            {result.insideMagnet
              ? "The paired-source surrogate is defined only outside the drawn bars, so no interior direction or index is reported."
              : result.directionDegrees === null
                ? `The left and right contribution indices are both ${result.leftContributionIndex}, but their vectors oppose at this symmetric point. The magnets still produce nonzero fields elsewhere.`
                : `The displayed ${result.relativeFieldIndex} / 100 index is a normalized comparison from the paired-source surrogate. It is not tesla, force, or a measurement of either bar.`}
          </p>
          <p>
            {result.facingPoles} poles {result.interaction}. This interaction
            label gives force direction only; the lesson does not calculate
            force magnitude or magnet motion.
          </p>
        </div>
      </div>
      <MagneticFieldsComparison
        key={comparisonVersion}
        onApply={applyGuidedState}
      />
      <div className="magnet-note">
        <p>{magneticFieldsCoreBoundary}</p>
        <details>
          <summary>Detailed model boundaries and assumptions</summary>
          <p>{magneticFieldsBoundary}</p>
        </details>
      </div>
    </section>
  );
}
