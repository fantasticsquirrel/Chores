import { lazy, Suspense, useEffect, useState } from "react";
import {
  RIVER_DEFAULT_INPUTS,
  RIVER_INITIAL_LEDGER,
  RIVER_STARTING_SOIL_KILOGRAMS,
  applyRiverStorm,
  riverStateAtPhase,
  type RiverInputs,
  type RiverLedger,
} from "@family-manager/family-api/discovery-models/river";
import { Slider } from "./SimulationPrimitives";
import { RiverPredictionTrials } from "./river/RiverPredictionTrials";
import { useRiverLesson } from "./river/useRiverLesson";
import "./landscape/landscape.css";
import "./river/river-sculptor.css";

const freshLedger = (): RiverLedger => ({ ...RIVER_INITIAL_LEDGER });
const LandscapeCanvas = lazy(() =>
  import("./landscape/LandscapeCanvas").then((module) => ({
    default: module.LandscapeCanvas,
  })),
);

export function RiverSculptorSimulation() {
  const [inputs, setInputs] = useState<RiverInputs>({
    ...RIVER_DEFAULT_INPUTS,
  });
  const [ledger, setLedger] = useState<RiverLedger>(freshLedger);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lesson = useRiverLesson();
  const result = riverStateAtPhase(
    inputs,
    phase,
    ledger.soilRemainingKilograms,
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 0.06) % 1),
      240,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", stopWhenHidden);
  }, []);

  const showTrial = (trial: RiverInputs) => {
    setInputs({ ...trial });
    setLedger(applyRiverStorm(trial, freshLedger()));
    setPhase(0);
    setPlaying(false);
  };
  const relockMotion = () => {
    setPhase(0);
    setPlaying(false);
  };
  const reset = () => {
    setInputs({ ...RIVER_DEFAULT_INPUTS });
    setLedger(freshLedger());
    setPhase(0);
    setPlaying(false);
    lesson.resetLesson();
  };
  const runStorm = () => {
    setLedger((current) => applyRiverStorm(inputs, current));
    setPhase(0);
    setPlaying(false);
  };
  const restoreSoil = () => {
    setLedger(freshLedger());
    setPhase(0);
    setPlaying(false);
  };
  const accountedSoil =
    ledger.soilRemainingKilograms +
    ledger.depositedKilograms +
    ledger.exportedKilograms;

  return (
    <section className="landscape-exhibit landscape-river dl-river">
      <div className="landscape-visual dl-river-visual">
        <header className="dl-river-header">
          <div>
            <h2>{result.runoffCubicMeters.toFixed(0)} m³ runoff</h2>
            <p>
              Next one-hour storm over 1 hectare · {result.rainfallMillimeters}{" "}
              mm rain
            </p>
          </div>
          <div className="dl-river-soil-summary">
            <strong>
              <output aria-label="Soil remaining">
                {ledger.soilRemainingKilograms.toFixed(1)} kg
              </output>
            </strong>
            <small>soil remains after {ledger.stormCount} storms</small>
          </div>
        </header>
        <Suspense
          fallback={
            <div
              className="landscape-canvas landscape-loading"
              role="img"
              aria-label="Loading the dimensional catchment."
            >
              Loading catchment geometry…
            </div>
          }
        >
          <LandscapeCanvas
            state={{
              kind: "river",
              slope: result.catchmentSlopePercent,
              rain: result.rainfallMillimeters,
              vegetation: result.vegetationCoverPercent,
              runoff: result.runoffCubicMeters,
              infiltration: result.infiltrationCubicMeters,
              eroded: result.soilMovedKilograms,
              flood: result.channelCapacityExcessCubicMeters,
              deposited: ledger.depositedKilograms,
              exported: ledger.exportedKilograms,
              soil: ledger.soilRemainingKilograms,
              phase: result.visualPhase,
            }}
            description={`Dimensional one-hectare catchment during a one-hour storm. Catchment slope ${result.catchmentSlopePercent} percent, rainfall ${result.rainfallMillimeters} millimeters and vegetation cover ${result.vegetationCoverPercent} percent. The next storm produces ${result.runoffCubicMeters.toFixed(1)} cubic meters runoff and moves ${result.soilMovedKilograms.toFixed(1)} kilograms of soil: ${result.depositedKilograms.toFixed(1)} kilograms deposits in the modeled reach and ${result.exportedKilograms.toFixed(1)} kilograms exits downstream. Across ${ledger.stormCount} applied storms, ${ledger.depositedKilograms.toFixed(1)} kilograms has deposited and ${ledger.exportedKilograms.toFixed(1)} kilograms has been exported.`}
          />
        </Suspense>
      </div>

      <div className="dl-river-stage-readouts">
        <div>
          <span>Next infiltration</span>
          <strong>{result.infiltrationCubicMeters.toFixed(1)} m³</strong>
        </div>
        <div>
          <span>Next soil moved</span>
          <strong>{result.soilMovedKilograms.toFixed(1)} kg</strong>
        </div>
        <div>
          <span>Next deposition</span>
          <strong>{result.depositedKilograms.toFixed(1)} kg</strong>
        </div>
        <div>
          <span>Next export</span>
          <strong>{result.exportedKilograms.toFixed(1)} kg</strong>
        </div>
      </div>

      <div className="dl-river-controls">
        <RiverPredictionTrials
          lesson={lesson}
          onShowTrial={showTrial}
          onPredictionChange={relockMotion}
        />
        <div className="dl-river-explore">
          <strong>
            {lesson.freeExploration
              ? "3 · Explore one variable"
              : "Reset the investigation"}
          </strong>
          {lesson.freeExploration ? (
            <>
              <p>
                Change one input at a time, restore the 5,000 kg soil baseline,
                then run equal one-storm trials.
              </p>
              <Slider
                label="Catchment slope"
                value={result.catchmentSlopePercent}
                min={0}
                max={20}
                unit="%"
                onChange={(catchmentSlopePercent) =>
                  setInputs((current) => ({
                    ...current,
                    catchmentSlopePercent,
                  }))
                }
              />
              <Slider
                label="Rainfall in one hour"
                value={result.rainfallMillimeters}
                min={0}
                max={100}
                unit=" mm"
                onChange={(rainfallMillimeters) =>
                  setInputs((current) => ({
                    ...current,
                    rainfallMillimeters,
                  }))
                }
              />
              <Slider
                label="Vegetation cover"
                value={result.vegetationCoverPercent}
                min={0}
                max={100}
                unit="%"
                onChange={(vegetationCoverPercent) =>
                  setInputs((current) => ({
                    ...current,
                    vegetationCoverPercent,
                  }))
                }
              />
              <Slider
                label="Sediment tracer phase"
                value={Math.round(result.visualPhase * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => {
                  setPlaying(false);
                  setPhase(value / 100);
                }}
              />
              <div className="dl-river-actions">
                <button type="button" onClick={runStorm}>
                  Run one storm
                </button>
                <button type="button" onClick={restoreSoil}>
                  Restore soil
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying((current) => !current)}
                >
                  {playing ? "Pause sediment tracer" : "Play sediment tracer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase(0);
                    setPlaying(false);
                  }}
                >
                  Start tracer
                </button>
              </div>
              <p className="dl-river-motion-note">
                Moving grains are slowed path markers, not measured sediment or
                water speed. The phase slider provides the same positions
                without motion.
              </p>
            </>
          ) : (
            <p>
              Reset clears both predictions and restores the 8% slope, 40 mm
              rain, 40% cover and 5,000 kg soil baseline.
            </p>
          )}
          <div className="dl-river-actions">
            <button type="button" onClick={reset}>
              Reset lesson
            </button>
          </div>
        </div>
      </div>

      <div className="dl-river-investigation">
        <div>
          <strong>Try this</strong>
          <p>
            What changes when vegetation or catchment slope changes while rain,
            area, duration and starting soil stay fixed? Predict, compare the
            fixed trials, then account for the moved soil.
          </p>
        </div>
        <div>
          <strong>What explains it?</strong>
          <p>
            Water that does not infiltrate becomes runoff in this model. Runoff
            detaches and transports soil; some deposits in the reach and the
            rest exits downstream. Vegetation changes runoff and soil
            protection. Slope changes only the teaching erosion and export
            terms.
          </p>
        </div>
      </div>

      <div className="dl-river-ledger" role="status" aria-live="polite">
        <span>
          <output aria-label="Storm count">Storm {ledger.stormCount}</output>
        </span>
        <span>
          Deposited: <strong>{ledger.depositedKilograms.toFixed(1)} kg</strong>
        </span>
        <span>
          Exported: <strong>{ledger.exportedKilograms.toFixed(1)} kg</strong>
        </span>
        <span>
          Soil ledger: {accountedSoil.toFixed(1)} kg ={" "}
          {RIVER_STARTING_SOIL_KILOGRAMS.toLocaleString()} kg start
        </span>
        <span>
          Beyond the illustrative 180 m³/h channel capacity:{" "}
          <strong>
            {result.channelCapacityExcessCubicMeters.toFixed(1)} m³
          </strong>
        </span>
      </div>
      <p className="dl-river-caveat">
        Model boundary: one uniform one-hour storm over a 1-hectare catchment,
        5,000 kg available soil and an invented 180 m³/h channel capacity. One
        millimeter over one hectare is 10 m³ of water. The runoff, erosion and
        export coefficients are teaching assumptions, not field measurements, a
        river simulation or a flood forecast. Soil type, changing rain,
        groundwater, evaporation, water storage, channel shape and sediment size
        are omitted. Terrain height, flood width, vegetation, rills and sediment
        grains are schematic.
      </p>
    </section>
  );
}
