import { lazy, Suspense, useState } from "react";
import {
  comparePhotosynthesisInputs,
  photosynthesisActivity,
  PHOTOSYNTHESIS_DEFAULT_INPUTS,
  PHOTOSYNTHESIS_LIGHT_STEPS,
  PHOTOSYNTHESIS_ZERO_WATER,
  type PhotosynthesisInputs,
} from "@family-manager/family-api/discovery-models/photosynthesis";
import { Slider } from "./SimulationPrimitives";
import {
  ActivityRow,
  PredictionButtons,
} from "./photosynthesis/PhotosynthesisLessonParts";
import { PhotosynthesisLivePanel } from "./photosynthesis/PhotosynthesisLivePanel";
import {
  changedList,
  resourceList,
  roundIndex,
  settingList,
} from "./photosynthesis/photosynthesisFormat";
import "./photosynthesis/photosynthesis.css";

const LeafCanvas = lazy(() =>
  import("./botany/LeafCanvas").then((module) => ({
    default: module.LeafCanvas,
  })),
);

type ZeroWaterPrediction = "" | "restores" | "stays-zero";
type LightStepsPrediction = "" | "keeps-rising" | "levels-off";

export function PhotosynthesisSimulation() {
  const [inputs, setInputs] = useState<PhotosynthesisInputs>({
    ...PHOTOSYNTHESIS_DEFAULT_INPUTS,
  });
  const [zeroPrediction, setZeroPrediction] = useState<ZeroWaterPrediction>("");
  const [zeroComplete, setZeroComplete] = useState(false);
  const [lightPrediction, setLightPrediction] =
    useState<LightStepsPrediction>("");
  const [lightComplete, setLightComplete] = useState(false);
  const [comparisonA, setComparisonA] = useState<PhotosynthesisInputs | null>(
    null,
  );

  const current = photosynthesisActivity(inputs);
  const zeroLow = photosynthesisActivity(PHOTOSYNTHESIS_ZERO_WATER.low);
  const zeroHigh = photosynthesisActivity(PHOTOSYNTHESIS_ZERO_WATER.high);
  const lightResults = PHOTOSYNTHESIS_LIGHT_STEPS.map((step) =>
    photosynthesisActivity(step),
  );
  const comparison = comparisonA
    ? comparePhotosynthesisInputs(comparisonA, inputs)
    : null;

  const reset = () => {
    setInputs({ ...PHOTOSYNTHESIS_DEFAULT_INPUTS });
    setZeroPrediction("");
    setZeroComplete(false);
    setLightPrediction("");
    setLightComplete(false);
    setComparisonA(null);
  };

  const chooseZeroPrediction = (prediction: ZeroWaterPrediction) => {
    setZeroPrediction(prediction);
    setZeroComplete(false);
    setLightPrediction("");
    setLightComplete(false);
  };

  const chooseLightPrediction = (prediction: LightStepsPrediction) => {
    setLightPrediction(prediction);
    setLightComplete(false);
  };

  return (
    <div className="leaf-learning-lab">
      <section className="leaf-visual-panel" aria-label="Current leaf model">
        <Suspense fallback={<p>Loading leaf model…</p>}>
          <LeafCanvas
            light={inputs.light}
            water={inputs.water}
            carbon={inputs.carbonDioxide}
            rate={current.activityIndex}
            limitingLabel={resourceList(current.limitingResources)}
          />
        </Suspense>
        <PhotosynthesisLivePanel current={current} />
      </section>

      <div className="leaf-guided-work">
        <section className="leaf-challenge leaf-zero-water">
          <h2>1. Test a missing input</h2>
          <p className="leaf-held-note">
            Hold water at 0% and carbon dioxide at 80%. Change only light.
          </p>
          <PredictionButtons
            label="Predict: what will 100% light do?"
            value={zeroPrediction}
            onChange={chooseZeroPrediction}
            options={[
              { value: "restores", label: "More light restores activity" },
              { value: "stays-zero", label: "Activity stays at zero" },
            ]}
          />
          <button
            className="leaf-run-button"
            type="button"
            disabled={!zeroPrediction}
            onClick={() => {
              setZeroComplete(true);
              setLightPrediction("");
              setLightComplete(false);
              setInputs({ ...PHOTOSYNTHESIS_ZERO_WATER.high });
            }}
          >
            Compare light at zero water
          </button>
          {zeroComplete && (
            <div className="leaf-observation">
              <div
                className="leaf-evidence"
                data-testid="leaf-zero-water-evidence"
                aria-label={`Water held at 0 percent. At 30 percent light the index is ${roundIndex(zeroLow.activityIndex)}. At 100 percent light the index is ${roundIndex(zeroHigh.activityIndex)}.`}
              >
                <p>Water held at 0% · carbon dioxide held at 80%</p>
                <ActivityRow
                  label="30% light"
                  inputs={{ ...PHOTOSYNTHESIS_ZERO_WATER.low }}
                />
                <ActivityRow
                  label="100% light"
                  inputs={{ ...PHOTOSYNTHESIS_ZERO_WATER.high }}
                />
              </div>
              <p
                className="leaf-feedback"
                data-testid="leaf-zero-water-feedback"
                role="status"
              >
                {zeroPrediction === "stays-zero"
                  ? "The result matches your prediction. "
                  : "The result differs from your prediction. "}
                Both indices are 0. More light cannot replace water, a matter
                input in photosynthesis.
              </p>
            </div>
          )}
        </section>

        <section className="leaf-challenge leaf-light-steps">
          <h2>2. Find the limiting input</h2>
          <p className="leaf-held-note">
            Hold water at 35% and carbon dioxide at 80%. Change only light.
          </p>
          {!zeroComplete ? (
            <p className="leaf-gate">
              Complete the zero-water comparison first.
            </p>
          ) : (
            <PredictionButtons
              label="Predict: what happens above 35% light?"
              value={lightPrediction}
              onChange={chooseLightPrediction}
              options={[
                { value: "keeps-rising", label: "Keeps rising with light" },
                {
                  value: "levels-off",
                  label: "Levels off once water limits",
                },
              ]}
            />
          )}
          <button
            className="leaf-run-button"
            type="button"
            disabled={!zeroComplete || !lightPrediction}
            onClick={() => {
              setLightComplete(true);
              setInputs({ ...PHOTOSYNTHESIS_LIGHT_STEPS[2] });
            }}
          >
            Compare three light levels
          </button>
          {lightComplete && (
            <div className="leaf-observation">
              <div
                className="leaf-evidence"
                data-testid="leaf-light-steps-evidence"
              >
                <p>Water: 35% · carbon dioxide: 80%</p>
                {PHOTOSYNTHESIS_LIGHT_STEPS.map((step) => (
                  <ActivityRow
                    key={step.light}
                    label={`${step.light}% light`}
                    inputs={{ ...step }}
                  />
                ))}
              </div>
              <p
                className="leaf-feedback"
                data-testid="leaf-light-steps-feedback"
                role="status"
              >
                {lightPrediction === "levels-off"
                  ? "The result matches your prediction. "
                  : "The result differs from your prediction. "}
                The index rises from {roundIndex(lightResults[0].activityIndex)}{" "}
                to {roundIndex(lightResults[1].activityIndex)}. At 35%, light
                and water tie. At 100% light it remains{" "}
                {roundIndex(lightResults[2].activityIndex)} because water limits
                this model.
              </p>
            </div>
          )}
        </section>
      </div>

      <details className="leaf-open-lab">
        <summary>Open controls</summary>
        <div className="leaf-open-grid">
          <div className="leaf-open-sliders">
            <Slider
              label="Light availability"
              value={inputs.light}
              min={0}
              max={100}
              unit="%"
              onChange={(light) => setInputs((old) => ({ ...old, light }))}
            />
            <Slider
              label="Water availability"
              value={inputs.water}
              min={0}
              max={100}
              unit="%"
              onChange={(water) => setInputs((old) => ({ ...old, water }))}
            />
            <Slider
              label="Carbon dioxide"
              value={inputs.carbonDioxide}
              min={0}
              max={100}
              unit="%"
              onChange={(carbonDioxide) =>
                setInputs((old) => ({ ...old, carbonDioxide }))
              }
            />
          </div>
          <div className="leaf-open-result">
            <button
              type="button"
              onClick={() => setComparisonA({ ...current.inputs })}
            >
              {comparisonA ? "Replace comparison A" : "Set comparison A"}
            </button>
            {comparisonA && comparison ? (
              <div data-testid="leaf-open-comparison" aria-live="polite">
                <p>
                  A:{" "}
                  {roundIndex(
                    photosynthesisActivity(comparisonA).activityIndex,
                  )}
                  /100 · current: {roundIndex(current.activityIndex)}/100
                </p>
                {comparison.changed.length === 0 ? (
                  <p>Change one resource to compare with A.</p>
                ) : (
                  <>
                    <p>
                      Changed:{" "}
                      {changedList(comparison.changed, comparisonA, inputs)}
                    </p>
                    <p>
                      Held:{" "}
                      {comparison.held.length
                        ? settingList(comparison.held, inputs)
                        : "none"}
                    </p>
                    {!comparison.controlled && (
                      <p>
                        Change only one resource for a controlled comparison.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p>Set A, then change one resource.</p>
            )}
          </div>
        </div>
      </details>

      <div className="leaf-model-note">
        <p className="leaf-model-summary">
          Invented settings and a lowest-response rule produce this toy index;
          it is not a measured photosynthesis rate or growth forecast.
        </p>
        <details>
          <summary>Model limits</summary>
          <p>
            The index does not measure sugar amount. It omits temperature,
            species, nutrients, stored water, time and stomatal behavior.
            Plants respire day and night; this index does not subtract
            respiration.
          </p>
        </details>
      </div>
      <div className="leaf-reset-row">
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}
