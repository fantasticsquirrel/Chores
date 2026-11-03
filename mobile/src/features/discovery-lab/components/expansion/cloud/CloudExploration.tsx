import { useState } from "react";
import {
  CLOUD_MAX_LIFT_M,
  cloudRainBoundary,
  cloudResult,
  defaultCloudState,
  normalizeCloud,
  type CloudState,
} from "@family-manager/family-api/discovery-models/cloud-rain";
import { Control, Dot, Line } from "../../Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "../../LearningPrimitives";
import { CloudComparison } from "./CloudComparison";

function outcome(result: ReturnType<typeof cloudResult>) {
  if (result.outcome === "invisible-vapor")
    return "No visible cloud; water vapor remains invisible.";
  if (result.outcome === "cloud-droplets")
    return "Visible liquid cloud droplets; no precipitation-sized particles.";
  if (result.outcome === "virga")
    return "Falling precipitation evaporates before reaching the ground (virga).";
  if (result.outcome === "rain-at-ground") return "Rain reaches the ground.";
  return "Drizzle reaches the ground.";
}

export function CloudExploration() {
  const [state, setState] = useState<CloudState>({ ...defaultCloudState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const result = cloudResult(state);
  const update = (next: CloudState) => {
    setState(normalizeCloud(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => update({ ...defaultCloudState });
  const stateText = outcome(result);
  const label =
    "Parcel lifted " +
    state.upliftM.toFixed(0) +
    " m: temperature " +
    result.parcelTemperatureC.toFixed(1) +
    " °C and relative humidity " +
    result.parcelRelativeHumidityPercent.toFixed(0) +
    "%. Estimated cloud base " +
    result.condensationHeightM.toFixed(0) +
    " m; condensed liquid water " +
    result.condensedWaterGPerKg.toFixed(2) +
    " g/kg dry air. Representative particle " +
    state.particleDiameterUm.toFixed(0) +
    " µm; below-cloud relative humidity " +
    state.subcloudRelativeHumidityPercent.toFixed(0) +
    "%. " +
    stateText;
  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram visualState={{ kind: "cloud-rain-lab", ...state }} label={label}>
        {(width) => {
          const cloudY = Math.max(55, 245 - state.upliftM / 10);
          const rainBottom = result.virga ? 225 : 285;
          return (
            <>
              <Line x={35} y={285} x2={35} y2={40} />
              <Dot
                x={width / 2}
                y={cloudY}
                size={result.cloud ? 76 : 35}
                color={result.cloud ? "#dbe7ee" : "#ebba67"}
              />
              {result.fallingPrecipitation &&
                [0, 1, 2, 3, 4].map((index) => (
                  <Line
                    key={index}
                    x={width / 2 - 32 + index * 16}
                    y={cloudY + 38}
                    x2={width / 2 - 38 + index * 16}
                    y2={rainBottom}
                    color={result.virga ? "#9ecbd0" : "#77d0f4"}
                  />
                ))}
              <DiagramLabel x={18} y={292}>
                {state.upliftM} m lift · {result.parcelTemperatureC.toFixed(1)}
                °C · {result.parcelRelativeHumidityPercent.toFixed(0)}% RH
              </DiagramLabel>
            </>
          );
        }}
      </Diagram>
      <Explanation>
        {label} Relative humidity is actual vapor pressure divided by saturation
        vapor pressure at the same temperature. At saturation, some invisible
        vapor condenses into visible liquid droplets. Real clouds may instead
        contain ice crystals or both phases.
      </Explanation>
      <Control
        label="Starting temperature (°C)"
        value={state.temperatureC}
        min={22}
        max={32}
        onChange={(temperatureC) => update({ ...state, temperatureC })}
      />
      <Control
        label="Starting relative humidity (%)"
        value={state.relativeHumidityPercent}
        min={30}
        max={95}
        onChange={(relativeHumidityPercent) =>
          update({ ...state, relativeHumidityPercent })
        }
      />
      <Control
        label="Parcel lift (m)"
        value={state.upliftM}
        min={0}
        max={CLOUD_MAX_LIFT_M}
        step={100}
        onChange={(upliftM) => update({ ...state, upliftM })}
      />
      <Control
        label="Representative particle diameter (µm)"
        value={state.particleDiameterUm}
        min={10}
        max={2_000}
        step={10}
        onChange={(particleDiameterUm) =>
          update({ ...state, particleDiameterUm })
        }
      />
      <Control
        label="Below-cloud relative humidity (%)"
        value={state.subcloudRelativeHumidityPercent}
        min={20}
        max={100}
        step={5}
        onChange={(subcloudRelativeHumidityPercent) =>
          update({ ...state, subcloudRelativeHumidityPercent })
        }
      />
      <Meter
        label="Parcel relative humidity"
        value={result.parcelRelativeHumidityPercent}
        detail={result.parcelRelativeHumidityPercent.toFixed(0) + "%"}
      />
      <Explanation>
        {stateText} A {state.particleDiameterUm.toFixed(0)} µm sphere has{" "}
        {result.particleVolumeRatioToCloudDroplet.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}
        × the volume of a 20 µm cloud droplet. Warm-cloud collision and
        coalescence can grow drops; drier air below cloud can evaporate them
        before ground level.
      </Explanation>
      <CloudComparison
        key={comparisonVersion}
        onApply={(next) => setState(normalizeCloud(next))}
      />
      <ModelNote>{cloudRainBoundary}</ModelNote>
    </LearningFrame>
  );
}
