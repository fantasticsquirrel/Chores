import { useState } from "react";
import {
  cloudResult,
  initialCloud,
  type CloudState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { createCloudRainScene } from "@family-manager/discovery-scenes/expansion/earth/clouds";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LandscapeInvestigation } from "../../landscape/LandscapeExhibit";
import { EarthExhibit, EarthMetric } from "./EarthExhibit";
export function CloudRainSimulation() {
  const [state, setState] = useState<CloudState>(initialCloud),
    result = cloudResult(state);
  const change = (key: keyof CloudState) => (value: number) =>
    setState((s) => ({ ...s, [key]: value }));
  const cloudState = result.rain
    ? "Cloud with falling drops"
    : result.cloud
      ? "Cloud without rain"
      : "No cloud yet";
  const description = `${cloudState}. Air lifted ${state.upliftM} metres cools to ${result.parcelTemperatureC.toFixed(1)} degrees Celsius. Approximate condensation level ${Math.round(result.condensationHeightM)} metres. Droplet-growth teaching index ${state.dropletGrowth}.`;
  return (
    <EarthExhibit
      question="Why can rising air make a cloud without rain?"
      introduction="Rising air expands and cools. At saturation, invisible water vapor can condense onto tiny particles, making visible cloud droplets. Droplets need additional growth before they fall as rain; cloud formation alone is not enough."
      scene={
        <ExpansionCanvas
          state={state}
          buildScene={createCloudRainScene}
          description={description}
          onSelect={() =>
            setState((s) => ({
              ...s,
              upliftM: Math.min(2000, s.upliftM + 200),
            }))
          }
        />
      }
      controls={
        <>
          <Slider
            label="Starting air temperature"
            value={state.temperatureC}
            min={20}
            max={35}
            unit=" °C"
            onChange={change("temperatureC")}
          />
          <Slider
            label="Starting water vapor"
            value={state.vaporGPerKg}
            min={2}
            max={14}
            unit=" g/kg dry air"
            onChange={change("vaporGPerKg")}
          />
          <Slider
            label="Air parcel lift"
            value={state.upliftM}
            min={0}
            max={2000}
            step={100}
            unit=" m"
            onChange={change("upliftM")}
          />
          <Slider
            label="Droplet-growth teaching index"
            value={state.dropletGrowth}
            min={0}
            max={100}
            step={5}
            onChange={change("dropletGrowth")}
          />
          <div className="earth-buttons">
            <button onClick={() => setState(initialCloud)}>
              Reset all conditions
            </button>
          </div>
          <p className="earth-control-note">
            Tap the parcel or cloud to add 200 m of lift. The highlighted parcel
            marks a volume of air, not a balloon; the small gold dots are
            diagram markers, not visible water vapor.
          </p>
        </>
      }
      evidence={
        <>
          <EarthMetric
            label="Lifted parcel temperature"
            value={`${result.parcelTemperatureC.toFixed(1)} °C`}
          />
          <EarthMetric
            label="Approximate condensation level"
            value={`${Math.round(result.condensationHeightM)} m`}
          />
          <EarthMetric label="Observed model state" value={cloudState} />
          <p>
            {result.cloud
              ? result.rain
                ? "Condensation and the chosen growth condition are both present, so this diagram shows falling drops."
                : "Cooling has reached saturation, but the growth setting does not yet produce falling drops in this diagram."
              : "This parcel has not reached its estimated condensation level. Increasing drop growth alone cannot make rain without cloud droplets."}
          </p>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Lift the same air",
              predict:
                "Will lifting the same air to 600 m and 1,800 m produce the same cloud state?",
              options: ["Same state", "Different states"],
              action:
                "Set up 600 m at 22 °C, 10 g/kg water vapor and growth 30. Note temperature and cloud state. Change only lift to 1,800 m and compare.",
              explain:
                "How did expansion and cooling connect the lift to condensation? Now hold lift fixed and increase starting temperature: why can that remove the cloud?",
              test: () => setState({ ...initialCloud, upliftM: 600 }),
              testLabel: "Set lift to 600 m",
            },
            {
              label: "Cloud is not rain",
              predict:
                "If the parcel is already cloudy, does that guarantee falling rain?",
              options: [
                "Cloud always means rain",
                "Droplets need extra growth",
              ],
              action:
                "Set up a cloud at 1,400 m, 22 °C and 10 g/kg, with growth 30. Keep those conditions fixed and change only growth to 90. Compare falling drops and the unchanged parcel temperature.",
              explain:
                "Which process formed the cloud, and which extra condition changed the falling-drop picture? Why is this teaching threshold not a forecast for a real cloud?",
              test: () => setState(initialCloud),
              testLabel: "Set cloud without rain",
            },
          ]}
        />
      }
      note="This warm-cloud parcel starts at a fixed 1,000 hPa. Condensation height is approximate; cooling uses fixed 9.8 °C/km before saturation and 6 °C/km afterward. Controls keep this parcel above freezing. Mixing, ice and evaporation are omitted. Growth is an invented index, with falling drops drawn at 65; it is not a measured droplet size, rainfall rate, or forecast. Real droplet growth and air motion are more complex."
    />
  );
}
