import { useState } from "react";
import {
  CLOUD_MAX_LIFT_M,
  cloudRainCoreBoundary,
  cloudRainBoundary,
  cloudResult,
  defaultCloudState,
  normalizeCloud,
  type CloudState,
} from "@family-manager/family-api/discovery-models/cloud-rain";
import { createCloudRainScene } from "@family-manager/discovery-scenes/expansion/earth/clouds";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { CloudRainComparison } from "./CloudRainComparison";
import { useCloudLiftReplay } from "./useCloudLiftReplay";
import "../mechanics/mechanics.css";
import "./cloud-rain.css";

function outcomeText(result: ReturnType<typeof cloudResult>) {
  if (result.outcome === "invisible-vapor")
    return "No cloud yet: water vapor remains invisible.";
  if (result.outcome === "cloud-droplets")
    return "Visible cloud droplets; no precipitation-sized particles.";
  if (result.outcome === "virga")
    return "Precipitation falls from the cloud but evaporates before the ground (virga).";
  if (result.outcome === "rain-at-ground") return "Rain reaches the ground.";
  return "Small liquid precipitation reaches the ground as drizzle.";
}

export function CloudRainSimulation() {
  const [state, setState] = useState<CloudState>({ ...defaultCloudState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const replay = useCloudLiftReplay(state.upliftM);
  const visualState = { ...state, upliftM: replay.visualLiftM };
  const result = cloudResult(visualState);
  const update = (next: CloudState) => {
    replay.cancel();
    setState(normalizeCloud(next));
    setComparisonVersion((value) => value + 1);
  };
  const applyGuidedState = (next: CloudState) => {
    replay.cancel();
    setState(normalizeCloud(next));
  };
  const reset = () => update({ ...defaultCloudState });
  const stateText = outcomeText(result);
  const groundDiameter = result.groundPrecipitation
    ? result.groundParticleDiameterUm.toFixed(0) + " µm"
    : result.virga
      ? "evaporated"
      : "—";
  const description =
    "Dimensional terrain, lake and lifted warm-air parcel. Starting temperature " +
    state.temperatureC.toFixed(0) +
    " degrees Celsius and relative humidity " +
    state.relativeHumidityPercent.toFixed(0) +
    " percent. At " +
    visualState.upliftM.toFixed(0) +
    " metres of lift, parcel temperature is " +
    result.parcelTemperatureC.toFixed(1) +
    " degrees Celsius and relative humidity is " +
    result.parcelRelativeHumidityPercent.toFixed(0) +
    " percent. Estimated cloud base " +
    result.condensationHeightM.toFixed(0) +
    " metres; modeled condensed liquid water " +
    result.condensedWaterGPerKg.toFixed(2) +
    " grams per kilogram of dry air. Representative particle diameter " +
    state.particleDiameterUm.toFixed(0) +
    " micrometres; below-cloud relative humidity " +
    state.subcloudRelativeHumidityPercent.toFixed(0) +
    " percent. " +
    stateText +
    " Water-vapor markers, liquid droplets, precipitation paths and text labels distinguish states without relying on color or motion. Vapor itself is invisible; real clouds may contain liquid droplets, ice crystals or both.";

  return (
    <section className="cloud-exhibit">
      <header className="cloud-heading">
        <h2>When does a cloud form, and when does rain reach the ground?</h2>
        <p>
          Predict first. Lift one parcel to test cooling and saturation, then
          change one particle-size input to test why a visible cloud need not
          produce rain at the ground.
        </p>
      </header>
      <ExpansionCanvas
        state={visualState}
        buildScene={createCloudRainScene}
        description={description}
        onSelect={() =>
          update({
            ...state,
            upliftM: Math.min(CLOUD_MAX_LIFT_M, state.upliftM + 200),
          })
        }
      />
      <div className="cloud-motion-toolbar">
        <button
          type="button"
          disabled={state.upliftM <= 0 || replay.running}
          onClick={replay.replay}
        >
          {replay.running ? "Replaying parcel lift…" : "Replay parcel lift"}
        </button>
        {replay.status && (
          <p className="cloud-motion-status" role="status">
            {replay.status}
          </p>
        )}
      </div>
      <div className="cloud-console">
        <div className="cloud-inputs">
          <Slider
            label="Starting parcel temperature"
            value={state.temperatureC}
            min={22}
            max={32}
            unit=" °C"
            onChange={(temperatureC) => update({ ...state, temperatureC })}
          />
          <Slider
            label="Starting relative humidity"
            value={state.relativeHumidityPercent}
            min={30}
            max={95}
            unit=" %"
            onChange={(relativeHumidityPercent) =>
              update({ ...state, relativeHumidityPercent })
            }
          />
          <Slider
            label="Parcel lift"
            value={state.upliftM}
            min={0}
            max={CLOUD_MAX_LIFT_M}
            step={100}
            unit=" m"
            onChange={(upliftM) => update({ ...state, upliftM })}
          />
          <Slider
            label="Representative particle diameter"
            value={state.particleDiameterUm}
            min={10}
            max={2_000}
            step={10}
            unit=" µm"
            onChange={(particleDiameterUm) =>
              update({ ...state, particleDiameterUm })
            }
          />
          <Slider
            label="Below-cloud relative humidity"
            value={state.subcloudRelativeHumidityPercent}
            min={20}
            max={100}
            step={5}
            unit=" %"
            onChange={(subcloudRelativeHumidityPercent) =>
              update({ ...state, subcloudRelativeHumidityPercent })
            }
          />
          <p className="cloud-control-note">
            Tap the parcel or cloud to add 200 m of lift. The gold points mark
            the parcel for the diagram; they are not visible water vapor.
          </p>
          <button className="cloud-reset" type="button" onClick={reset}>
            Reset lesson
          </button>
        </div>
        <div className="cloud-results" aria-live="polite" aria-atomic="true">
          <div className="cloud-measures">
            <div>
              <span>Parcel temperature</span>
              <strong>
                {result.parcelTemperatureC.toFixed(1)} <small>°C</small>
              </strong>
            </div>
            <div>
              <span>Parcel relative humidity</span>
              <strong>
                {result.parcelRelativeHumidityPercent.toFixed(0)}{" "}
                <small>%</small>
              </strong>
            </div>
            <div>
              <span>Estimated cloud base</span>
              <strong>
                {result.condensationHeightM.toFixed(0)} <small>m</small>
              </strong>
            </div>
            <div>
              <span>Modeled condensed water</span>
              <strong>
                {result.condensedWaterGPerKg.toFixed(2)} <small>g/kg</small>
              </strong>
            </div>
            <div>
              <span>Particle in cloud</span>
              <strong>
                {state.particleDiameterUm.toFixed(0)} <small>µm</small>
              </strong>
            </div>
            <div>
              <span>Estimated at ground</span>
              <strong className="cloud-ground-value">{groundDiameter}</strong>
            </div>
          </div>
          <div
            className="cloud-process"
            aria-label={
              "Lift to " +
              visualState.upliftM.toFixed(0) +
              " metres cools the parcel to " +
              result.parcelTemperatureC.toFixed(1) +
              " degrees Celsius and changes relative humidity to " +
              result.parcelRelativeHumidityPercent.toFixed(0) +
              " percent. " +
              stateText
            }
          >
            <span>lift and expansion</span>
            <b aria-hidden="true">→</b>
            <span>cooling</span>
            <b aria-hidden="true">→</b>
            <span>saturation at 100% RH</span>
            <b aria-hidden="true">→</b>
            <span>condensation</span>
          </div>
          <h3>{stateText}</h3>
          <p>
            Relative humidity compares actual vapor pressure with saturation
            vapor pressure at the same temperature. Rising and cooling raise
            this percentage here; at 100%, condensation and evaporation can both
            continue while liquid droplets make the cloud visible.
          </p>
          <p>
            The representative particle is{" "}
            <strong>{state.particleDiameterUm.toFixed(0)} µm</strong>. A sphere
            of that diameter has{" "}
            <strong>
              {result.particleVolumeRatioToCloudDroplet.toLocaleString(
                "en-US",
                {
                  maximumFractionDigits: 0,
                },
              )}
              ×
            </strong>{" "}
            the volume of a 20 µm cloud droplet. Warm-cloud collision and
            coalescence can build larger drops; the model does not simulate each
            collision.
          </p>
          <p>
            {!result.cloud
              ? "No condensed cloud is modeled at this lift, so no precipitation particle is drawn."
              : result.fallingPrecipitation
                ? result.virga
                  ? "The simplified evaporation path reduces the " +
                    state.particleDiameterUm.toFixed(0) +
                    " µm particle to zero before ground level, so the scene shows virga."
                  : "The simplified evaporation path estimates " +
                    result.groundParticleDiameterUm.toFixed(0) +
                    " µm at the ground through a " +
                    state.subcloudRelativeHumidityPercent.toFixed(0) +
                    "% RH layer."
                : "This particle remains part of the cloud in the model. A visible cloud is evidence of condensed droplets, not proof that rain will reach the ground."}
          </p>
        </div>
      </div>
      <CloudRainComparison key={comparisonVersion} onApply={applyGuidedState} />
      <div className="cloud-note">
        <p>{cloudRainCoreBoundary}</p>
        <details>
          <summary>Detailed model boundaries and assumptions</summary>
          <p>{cloudRainBoundary}</p>
        </details>
      </div>
    </section>
  );
}
