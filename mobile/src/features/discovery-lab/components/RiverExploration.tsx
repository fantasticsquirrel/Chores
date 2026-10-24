import { useState } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { riverStorm } from "@family-manager/family-api/discovery-models/physical-world";
import { Control, Dot, Line } from "./Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

export function RiverExploration() {
  const [slope, setSlope] = useState(5);
  const [rain, setRain] = useState(40);
  const [vegetation, setVegetation] = useState(50);
  const [soil, setSoil] = useState(5000);
  const [storms, setStorms] = useState(0);
  const [deposited, setDeposited] = useState(0);
  const [exported, setExported] = useState(0);
  const model = riverStorm(slope, rain, vegetation, soil);
  return (
    <LearningFrame
      onReset={() => {
        setSlope(5);
        setRain(40);
        setVegetation(50);
        setSoil(5000);
        setStorms(0);
        setDeposited(0);
        setExported(0);
      }}
    >
      <Diagram
        visualState={{
          kind: "river",
          slope,
          rain,
          vegetation,
          runoff: model.runoff,
          infiltration: model.infiltration,
          eroded: model.eroded,
          flood: model.floodVolume,
          deposited,
          soil,
        }}
        label={`One-hour storm: ${model.runoff.toFixed(0)} cubic metres of runoff, ${model.eroded.toFixed(0)} kg soil eroded, ${model.floodVolume.toFixed(0)} cubic metres beyond channel capacity.`}
      >
        {(width) => (
          <>
            <Line
              x={20}
              y={80 - slope * 2}
              x2={width * 0.64}
              y2={150}
              color="#d9b38a"
            />
            <Line
              x={width * 0.64}
              y={150}
              x2={width - 20}
              y2={165}
              color="#d9b38a"
            />
            {Array.from({ length: Math.round(vegetation / 10) }, (_, i) => (
              <Line
                key={i}
                x={25 + (i * (width * 0.55)) / 10}
                y={83 + i * 6 - slope}
                x2={25 + (i * (width * 0.55)) / 10}
                y2={63 + i * 6 - slope}
                color="#8bdda1"
              />
            ))}
            {Array.from({ length: 18 }, (_, i) => (
              <Dot
                key={i}
                x={20 + (i / 17) * (width - 40)}
                y={100 + i * 3.6}
                size={3 + model.runoff / 180}
                color="#79d8ef"
              />
            ))}
            {Array.from(
              { length: Math.min(20, Math.round(model.deposited / 20)) },
              (_, i) => (
                <Dot
                  key={i}
                  x={width * 0.64 + (i % 5) * 7}
                  y={178 + Math.floor(i / 5) * 6}
                  size={5}
                  color="#e6bc85"
                />
              ),
            )}
            <DiagramLabel x={15} y={12}>
              Hillslope → river → downstream
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Meter
        label="Rainfall volume"
        value={model.rainVolume}
        max={1200}
        detail={`${model.rainVolume.toFixed(0)} m³`}
      />
      <Meter
        label="Infiltration"
        value={model.infiltration}
        max={1200}
        detail={`${model.infiltration.toFixed(0)} m³`}
      />
      <Meter
        label="Runoff"
        value={model.runoff}
        max={1200}
        detail={`${model.runoff.toFixed(0)} m³`}
        color="#256c9a"
      />
      <Explanation>
        {model.eroded.toFixed(0)} kg of soil erodes:{" "}
        {model.deposited.toFixed(0)} kg settles downstream and{" "}
        {model.exported.toFixed(0)} kg leaves the reach. Flood overflow:{" "}
        {model.floodVolume.toFixed(0)} m³.
      </Explanation>
      <Control
        label="Slope (%)"
        value={slope}
        min={1}
        max={20}
        onChange={setSlope}
      />
      <Control
        label="Rainfall"
        value={rain}
        min={0}
        max={120}
        step={10}
        onChange={setRain}
      />
      <Control
        label="Vegetation cover (%)"
        value={vegetation}
        min={0}
        max={100}
        step={10}
        onChange={setVegetation}
      />
      <ActionButton
        label="Run one storm"
        onPress={() => {
          setSoil(Math.max(0, soil - model.eroded));
          setStorms(storms + 1);
          setDeposited(deposited + model.deposited);
          setExported(exported + model.exported);
        }}
      />
      <Explanation>
        {storms} storms applied. Available soil: {soil.toFixed(0)} kg. The
        measurements above predict the next storm.
      </Explanation>
      <Explanation>
        Soil ledger: {soil.toFixed(1)} kg remaining + {deposited.toFixed(1)} kg
        deposited + {exported.toFixed(1)} kg exported ={" "}
        {(soil + deposited + exported).toFixed(1)} kg. Deposition and export are
        cumulative across applied storms.
      </Explanation>
      <ModelNote>
        Reset starts with 5,000 kg of available soil in a one-hectare catchment.
        Rainfall is millimetres in one hour. Plants increase infiltration and
        protect soil; they cannot prevent every flood. Coefficients illustrate
        relationships, not a forecast for a real river.
      </ModelNote>
    </LearningFrame>
  );
}
