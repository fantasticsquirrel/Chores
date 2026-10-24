import { useState } from "react";
import { riverStorm } from "@family-manager/family-api/discovery-models/physical-world";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeInvestigation,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
const freshSoil = { storms: 0, soil: 5000, deposited: 0, exported: 0 };
export function RiverSculptorSimulation() {
  const [slope, setSlope] = useState(8),
    [rain, setRain] = useState(40),
    [vegetation, setVegetation] = useState(40),
    [history, setHistory] = useState(freshSoil);
  const next = riverStorm(slope, rain, vegetation, history.soil);
  const run = () =>
    setHistory((current) => {
      const storm = riverStorm(slope, rain, vegetation, current.soil);
      return {
        storms: current.storms + 1,
        soil: current.soil - storm.eroded,
        deposited: current.deposited + storm.deposited,
        exported: current.exported + storm.exported,
      };
    });
  const reset = () => {
    setSlope(8);
    setRain(40);
    setVegetation(40);
    setHistory(freshSoil);
  };
  return (
    <LandscapeExhibit
      title="Where does the soil go?"
      introduction="Change the catchment, then run a storm. Follow water downhill and account for the soil it moves."
      state={{
        kind: "river",
        slope,
        rain,
        vegetation,
        runoff: next.runoff,
        infiltration: next.infiltration,
        eroded: next.eroded,
        flood: next.floodVolume,
        deposited: history.deposited,
        soil: history.soil,
      }}
      description={`Valley cutaway: slope ${slope} percent, vegetation ${vegetation} percent. Next storm: ${rain} millimeters rain, ${next.runoff.toFixed(0)} cubic meters runoff, ${next.floodVolume.toFixed(0)} beyond channel capacity. ${history.storms} storms applied. ${history.deposited.toFixed(1)} kilograms deposited and ${history.exported.toFixed(1)} exported.`}
      controls={
        <>
          <Slider
            label="Channel slope"
            value={slope}
            min={1}
            max={20}
            unit="%"
            onChange={setSlope}
          />
          <Slider
            label="Rainfall"
            value={rain}
            min={0}
            max={100}
            unit=" mm"
            onChange={setRain}
          />
          <Slider
            label="Vegetation cover"
            value={vegetation}
            min={0}
            max={100}
            unit="%"
            onChange={setVegetation}
          />
          <div className="landscape-actions">
            <button type="button" onClick={run}>
              Run one storm
            </button>
            <button type="button" onClick={() => setHistory(freshSoil)}>
              Restore soil
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </>
      }
      evidence={
        <>
          <div className="landscape-metrics">
            <LandscapeMetric
              label="Next runoff"
              value={`${next.runoff.toFixed(0)} m³`}
            >
              <small>
                {next.infiltration.toFixed(0)} m³ infiltrates the ground
              </small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Beyond channel capacity"
              value={`${next.floodVolume.toFixed(0)} m³`}
            >
              <small>Pale water marks the flood extent preview</small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Next soil moved"
              value={`${next.eroded.toFixed(1)} kg`}
            >
              <small>
                {next.deposited.toFixed(1)} kg deposits ·{" "}
                {next.exported.toFixed(1)} kg leaves
              </small>
            </LandscapeMetric>
            <div className="landscape-metric">
              <span>
                <strong>Storm {history.storms}</strong> · Soil remaining
              </span>
              <strong>
                <output aria-label="Soil remaining">
                  {history.soil.toFixed(1)} kg
                </output>
              </strong>
              <small>Changes only after you run a storm</small>
            </div>
          </div>
          <p className="landscape-observation" role="status">
            Across all storms:{" "}
            <strong>{history.deposited.toFixed(1)} kg deposited here</strong>{" "}
            and{" "}
            <strong>
              {history.exported.toFixed(1)} kg exported downstream
            </strong>
            . Remaining + deposited + exported ={" "}
            {(history.soil + history.deposited + history.exported).toFixed(0)}{" "}
            kg. Erosion moves soil; it does not make the material disappear.
          </p>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Compare vegetation",
              predict:
                "Will more vegetation reduce both runoff and soil export?",
              options: ["Both", "Runoff only", "Neither"],
              action:
                "Set bare ground and run one storm. Note the exported soil. Restore soil, change only vegetation to 100%, and run one storm again.",
              explain:
                "Compare equal starting soil, rain and slope. Vegetation increases infiltration and reduces erosion in this model. Which two changes explain the export difference?",
              test: () => {
                setSlope(8);
                setRain(40);
                setVegetation(0);
                setHistory(freshSoil);
              },
              testLabel: "Set bare-ground baseline",
            },
            {
              label: "Compare slopes",
              predict:
                "With the same rain and vegetation, does a steeper slope change runoff or soil moved?",
              options: ["Both", "Soil moved", "Neither"],
              action:
                "Use 40 mm rain and 40% vegetation. Run one storm at 2%. Restore soil, change only slope to 20%, and repeat.",
              explain:
                "The runoff formula here depends on rain and vegetation, not slope. Steeper slopes increase erosion and the share exported. What stayed unchanged?",
              test: () => {
                setRain(40);
                setVegetation(40);
                setSlope(2);
                setHistory(freshSoil);
              },
              testLabel: "Set gentle slope",
            },
          ]}
        />
      }
      note="One-hour storm on a 1-hectare catchment. Channel capacity is 180 m³/hour. Soil and water quantities are calculated with illustrative coefficients, not measured or forecast. Terrain, tree density, flood width and sediment piles are schematic. No evaporation or water storage is modeled. The pale water is the next-storm preview; deposited sediment records storms already run."
    />
  );
}
