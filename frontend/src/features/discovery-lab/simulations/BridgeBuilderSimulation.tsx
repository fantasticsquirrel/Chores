import { useEffect, useMemo, useState } from "react";
import {
  BRIDGE_DEFAULT_INPUTS,
  bridgeActivity,
  bridgeDeflectionMillimetersAt,
  type BridgeInputs,
} from "@family-manager/family-api/discovery-models/bridge";
import { Slider } from "./SimulationPrimitives";
import { BridgeDrawing } from "./BridgeDrawing";
import {
  PhysicalLayout,
  PhysicalStage,
} from "./physical-exhibits/PhysicalStage";
import { BridgePredictionTrials } from "./bridge/BridgePredictionTrials";
import { useBridgeLesson } from "./bridge/useBridgeLesson";
import "./physical-exhibits/physical-exhibits.css";

export function BridgeBuilderSimulation() {
  const [inputs, setInputs] = useState<BridgeInputs>(BRIDGE_DEFAULT_INPUTS);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lesson = useBridgeLesson();
  const result = bridgeActivity(inputs);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(100, now - previous);
      previous = now;
      setPhase((current) => (current + elapsed / 4_500) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", stopWhenHidden);
  }, []);

  const showTrial = (trial: BridgeInputs) => {
    setInputs(trial);
    setPhase(0);
    setPlaying(false);
  };
  const relock = () => {
    setPhase(0);
    setPlaying(false);
  };
  const reset = () => {
    setInputs(BRIDGE_DEFAULT_INPUTS);
    setPhase(0);
    setPlaying(false);
    lesson.resetLesson();
  };
  const toggleBrace = (index: number) =>
    setInputs((current) => ({
      ...current,
      braces: current.braces.map((on, i) => (i === index ? !on : on)),
    }));

  const beamProfile = useMemo(() => {
    const samples = Array.from({ length: 41 }, (_, index) => {
      const xMeters = (index / 40) * result.spanMeters;
      return {
        x: 18 + (index / 40) * 684,
        deflection: bridgeDeflectionMillimetersAt(result.inputs, xMeters),
      };
    });
    const maximum = Math.max(...samples.map((sample) => sample.deflection), 1);
    return samples
      .map(
        (sample, index) =>
          `${index ? "L" : "M"}${sample.x.toFixed(1)} ${(22 + (sample.deflection / maximum) * 34).toFixed(1)}`,
      )
      .join(" ");
  }, [result]);

  return (
    <PhysicalLayout
      question="What changes when one static point load moves along the span or doubles? Predict first, compare fixed trials, then explain the support reactions, bending moment and deflection."
      explanation="For static equilibrium, the two upward reactions sum to the downward load and their torques balance. The nearer support carries more when the load moves off-center. With span and flexural rigidity fixed, this small-deflection beam equation is linear in point load."
      caveat="Model boundary: one static point load on a 10 m simply supported Euler–Bernoulli equivalent beam with constant flexural rigidity EI. The displayed deflection uses the small-deflection equation and is visually enlarged. The timber truss is an illustration, not the solved structure. Self-weight, multiple axles, connections, shear, buckling, fatigue, impact, wind, material limits and safety factors are omitted. Brace modifiers change only an invented comparison index, not the beam calculation. This is not a construction design, load rating or safety certification."
      controls={
        <>
          <BridgePredictionTrials
            lesson={lesson}
            onShowTrial={showTrial}
            onPredictionChange={relock}
          />
          <div className="dl-bridge-explore">
            <strong>
              {lesson.freeExploration
                ? "3 · Explore one variable"
                : "Reset the investigation"}
            </strong>
            {lesson.freeExploration ? (
              <>
                <p>
                  Change one control at a time. Beam results and the invented
                  brace-reference index are reported separately.
                </p>
                <Slider
                  label="Load position"
                  value={result.inputs.loadPositionPercent}
                  min={5}
                  max={95}
                  unit="%"
                  onChange={(loadPositionPercent) =>
                    setInputs((current) => ({
                      ...current,
                      loadPositionPercent,
                    }))
                  }
                />
                <Slider
                  label="Point load"
                  value={result.inputs.pointLoadKilonewtons}
                  min={0}
                  max={30}
                  unit=" kN"
                  onChange={(pointLoadKilonewtons) =>
                    setInputs((current) => ({
                      ...current,
                      pointLoadKilonewtons,
                    }))
                  }
                />
                <Slider
                  label="Beam flexural rigidity"
                  value={result.inputs.flexuralRigidityMeganewtonMetersSquared}
                  min={50}
                  max={250}
                  step={10}
                  unit=" MN·m²"
                  onChange={(flexuralRigidityMeganewtonMetersSquared) =>
                    setInputs((current) => ({
                      ...current,
                      flexuralRigidityMeganewtonMetersSquared,
                    }))
                  }
                />
                <Slider
                  label="Load-path phase"
                  value={Math.round(phase * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(value) => {
                    setPlaying(false);
                    setPhase(value / 100);
                  }}
                />
                <div className="dl-physical-shortcuts">
                  <button
                    type="button"
                    onClick={() => setPlaying((current) => !current)}
                  >
                    {playing ? "Pause load path" : "Play load path"}
                  </button>
                  <button type="button" onClick={() => setPhase(0)}>
                    Start load path
                  </button>
                </div>
                <p className="dl-bridge-motion-note">
                  Moving dots are a slowed force-path diagram, not structural
                  vibration or truck speed.
                </p>
              </>
            ) : (
              <p>
                Reset clears both predictions and restores the 12 kN midspan
                baseline.
              </p>
            )}
            <div className="dl-actions">
              <button type="button" onClick={reset}>
                Reset lesson
              </button>
            </div>
          </div>
        </>
      }
      readout={
        <>
          <span>
            Peak bending moment:{" "}
            <strong>
              <output aria-label="Peak bending moment">
                {result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m
              </output>
            </strong>
          </span>
          <span>
            Deflection at load:{" "}
            <strong>
              <output aria-label="Deflection at load">
                {result.deflectionAtLoadMillimeters.toFixed(2)} mm
              </output>
            </strong>
          </span>
          <span>
            Reactions:{" "}
            {(
              result.leftReactionKilonewtons + result.rightReactionKilonewtons
            ).toFixed(1)}
            {" kN = applied "}
            {result.inputs.pointLoadKilonewtons.toFixed(1)} kN
          </span>
          <span>
            Flexural rigidity EI:{" "}
            {result.inputs.flexuralRigidityMeganewtonMetersSquared} MN·m²
          </span>
        </>
      }
    >
      <PhysicalStage
        state={{
          kind: "bridge",
          material: "timber",
          braces: result.inputs.braces,
          load: result.inputs.pointLoadKilonewtons,
          position: result.inputs.loadPositionPercent,
          utilization: result.braceReferenceUseIndex,
          leftReaction: result.leftReactionKilonewtons,
          rightReaction: result.rightReactionKilonewtons,
          progress: phase,
          deflectionMillimeters: result.deflectionAtLoadMillimeters,
        }}
        onAction={(action) => {
          if (lesson.freeExploration && action.type === "position")
            setInputs((current) => ({
              ...current,
              loadPositionPercent: action.value,
            }));
        }}
        description={`Dimensional timber demonstration bridge over a river. One static ${result.inputs.pointLoadKilonewtons} kilonewton point load is at ${result.inputs.loadPositionPercent} percent of a 10 meter simply supported equivalent beam. The computed left reaction is ${result.leftReactionKilonewtons.toFixed(1)} kilonewtons, the right reaction is ${result.rightReactionKilonewtons.toFixed(1)} kilonewtons, peak bending moment is ${result.peakBendingMomentKilonewtonMeters.toFixed(1)} kilonewton meters, and deflection at the load is ${result.deflectionAtLoadMillimeters.toFixed(2)} millimeters. The timber truss and moving load-path dots are explanatory artwork, not a solved truss or safety result.`}
        fallback={
          <BridgeDrawing
            braces={result.inputs.braces}
            load={result.inputs.pointLoadKilonewtons}
            position={result.inputs.loadPositionPercent}
            result={result}
          />
        }
        header={
          <div className="dl-physical-header">
            <div>
              <h3>
                {result.inputs.pointLoadKilonewtons} kN at{" "}
                {result.inputs.loadPositionPercent === 50
                  ? "midspan"
                  : `${result.inputs.loadPositionPercent}% of the span`}
              </h3>
              <p>
                {lesson.freeExploration
                  ? "Drag the truck or use the controls. Change one variable, then compare the numbers."
                  : "Use the two prediction comparisons below. Controls unlock after both results."}
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>
                <output aria-label="Deflection at load summary">
                  {result.deflectionAtLoadMillimeters.toFixed(2)} mm
                </output>
              </strong>
              <small>computed deflection at load</small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-reactions">
          <div>
            Left reaction ↑
            <output aria-label="Left support force">
              {result.leftReactionKilonewtons.toFixed(1)} kN
            </output>
          </div>
          <span>10 m simply supported equivalent beam</span>
          <div>
            Right reaction ↑
            <output aria-label="Right support force">
              {result.rightReactionKilonewtons.toFixed(1)} kN
            </output>
          </div>
        </div>
        <div
          className="dl-physical-trace dl-bridge-profile"
          role="img"
          aria-label={`Equivalent-beam deflection profile, visibly enlarged. Deflection at the point load is ${result.deflectionAtLoadMillimeters.toFixed(2)} millimeters. Supports remain at zero deflection.`}
        >
          <div className="dl-physical-trace-heading">
            <strong>Equivalent-beam deflection profile</strong>
            <span>
              {result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m ·{" "}
              {result.deflectionAtLoadMillimeters.toFixed(2)} mm at load
            </span>
          </div>
          <svg viewBox="0 0 720 68" aria-hidden="true">
            <path d="M18 22H702" stroke="#58727a" strokeDasharray="5 5" />
            <path
              d={beamProfile}
              fill="none"
              stroke="#9ee0cf"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d={`M${18 + (result.inputs.loadPositionPercent / 100) * 684} 4V56`}
              stroke="#f0c876"
              strokeWidth="3"
            />
            <circle cx="18" cy="22" r="5" fill="#eef0d8" />
            <circle cx="702" cy="22" r="5" fill="#eef0d8" />
          </svg>
          <p>
            Shape is enlarged for comparison; the numeric millimeter value is
            computed. The dashed line is the unloaded beam axis.
          </p>
        </div>
        {lesson.freeExploration && (
          <div className="dl-physical-strip" aria-label="Brace index modifiers">
            {result.inputs.braces.map((on, index) => (
              <button
                type="button"
                key={index}
                aria-label={`Brace section ${index + 1}`}
                aria-pressed={on}
                onClick={() => toggleBrace(index)}
              >
                <strong>
                  Section {index + 1}
                  <span className="dl-physical-stress">
                    {result.braceReferenceUseIndex[index].toFixed(2)}×
                  </span>
                </strong>
                <span>
                  {on
                    ? "Brace modifier on · remove"
                    : "Apply brace index modifier"}
                </span>
              </button>
            ))}
          </div>
        )}
        {lesson.freeExploration && (
          <p className="dl-bridge-index-note">
            Brace reference-use is an invented comparison index (zone moment ÷
            16 kN·m, then ÷ 2.4 when selected), not a capacity, allowable load
            or safety check. It does not change the beam reactions, moment or
            deflection.
          </p>
        )}
      </PhysicalStage>
    </PhysicalLayout>
  );
}
