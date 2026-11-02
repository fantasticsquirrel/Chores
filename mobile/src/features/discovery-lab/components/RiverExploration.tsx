import { useState } from "react";
import { Text, View } from "react-native";
import {
  RIVER_DEFAULT_INPUTS,
  RIVER_INITIAL_LEDGER,
  RIVER_SLOPE_COMPARISON,
  RIVER_VEGETATION_COMPARISON,
  applyRiverStorm,
  compareRiverTrials,
  riverActivity,
  riverStateAtPhase,
  type RiverInputs,
  type RiverLedger,
} from "@family-manager/family-api/discovery-models/river";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

type VegetationPrediction = "" | "both" | "runoff-only" | "neither";
type SlopePrediction = "" | "both" | "soil-only" | "neither";

const vegetationEvidence = RIVER_VEGETATION_COMPARISON.map((inputs) =>
  riverActivity(inputs),
);
const slopeEvidence = RIVER_SLOPE_COMPARISON.map((inputs) =>
  riverActivity(inputs),
);
const vegetationVariables = compareRiverTrials(...RIVER_VEGETATION_COMPARISON);
const slopeVariables = compareRiverTrials(...RIVER_SLOPE_COMPARISON);
const freshLedger = (): RiverLedger => ({ ...RIVER_INITIAL_LEDGER });

export function RiverExploration() {
  const [inputs, setInputs] = useState<RiverInputs>({
    ...RIVER_DEFAULT_INPUTS,
  });
  const [ledger, setLedger] = useState<RiverLedger>(freshLedger);
  const [phase, setPhase] = useState(0);
  const [vegetationPrediction, setVegetationPrediction] =
    useState<VegetationPrediction>("");
  const [slopePrediction, setSlopePrediction] = useState<SlopePrediction>("");
  const [vegetationComplete, setVegetationComplete] = useState(false);
  const [slopeComplete, setSlopeComplete] = useState(false);
  const result = riverStateAtPhase(
    inputs,
    phase / 100,
    ledger.soilRemainingKilograms,
  );
  const freeExploration = vegetationComplete && slopeComplete;
  const reset = () => {
    setInputs({ ...RIVER_DEFAULT_INPUTS });
    setLedger(freshLedger());
    setPhase(0);
    setVegetationPrediction("");
    setSlopePrediction("");
    setVegetationComplete(false);
    setSlopeComplete(false);
  };
  const showTrial = (trial: RiverInputs) => {
    setInputs({ ...trial });
    setLedger(applyRiverStorm(trial, freshLedger()));
    setPhase(0);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        visualState={{
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
        label={`Dimensional one-hectare catchment during a one-hour storm. Catchment slope ${result.catchmentSlopePercent} percent, rainfall ${result.rainfallMillimeters} millimeters and vegetation cover ${result.vegetationCoverPercent} percent. Next runoff ${result.runoffCubicMeters.toFixed(1)} cubic meters. Next soil moved ${result.soilMovedKilograms.toFixed(1)} kilograms: ${result.depositedKilograms.toFixed(1)} kilograms deposits and ${result.exportedKilograms.toFixed(1)} kilograms exits downstream. Across ${ledger.stormCount} applied storms, ${ledger.depositedKilograms.toFixed(1)} kilograms deposited and ${ledger.exportedKilograms.toFixed(1)} kilograms exported.`}
      >
        {(width) => (
          <>
            <Line
              x={20}
              y={70 - result.catchmentSlopePercent * 1.5}
              x2={width * 0.64}
              y2={145}
              color="#d9b38a"
            />
            <Line
              x={width * 0.64}
              y={145}
              x2={width - 20}
              y2={165}
              color="#d9b38a"
            />
            {Array.from(
              { length: Math.round(result.vegetationCoverPercent / 10) },
              (_, index) => (
                <Line
                  key={`plant-${index}`}
                  x={25 + (index * (width * 0.55)) / 10}
                  y={83 + index * 6 - result.catchmentSlopePercent}
                  x2={25 + (index * (width * 0.55)) / 10}
                  y2={63 + index * 6 - result.catchmentSlopePercent}
                  color="#8bdda1"
                />
              ),
            )}
            {Array.from({ length: 18 }, (_, index) => (
              <Dot
                key={`water-${index}`}
                x={20 + (index / 17) * (width - 40)}
                y={98 + index * 3.7}
                size={3 + result.runoffCubicMeters / 180}
                color="#79d8ef"
              />
            ))}
            {Array.from(
              {
                length: Math.min(18, Math.ceil(result.soilMovedKilograms / 18)),
              },
              (_, index) => (
                <Dot
                  key={`sediment-${index}`}
                  x={
                    20 + ((index / 18 + result.visualPhase) % 1) * (width - 40)
                  }
                  y={111 + ((index * 7) % 55)}
                  size={5}
                  color="#f0c58b"
                />
              ),
            )}
            <DiagramLabel x={15} y={12}>
              Hillslope → channel → downstream
            </DiagramLabel>
          </>
        )}
      </Diagram>

      <Explanation>
        Next storm: {result.runoffCubicMeters.toFixed(1)} m³ runoff and{" "}
        {result.infiltrationCubicMeters.toFixed(1)} m³ infiltration. It moves{" "}
        {result.soilMovedKilograms.toFixed(1)} kg soil:{" "}
        {result.depositedKilograms.toFixed(1)} kg deposits and{" "}
        {result.exportedKilograms.toFixed(1)} kg exits downstream.
      </Explanation>

      <Text accessibilityRole="header" style={headingStyle}>
        1. Add vegetation
      </Text>
      <Explanation>
        Change only vegetation from 0% to 100%. What happens during the same 40
        mm storm on the same 8% slope?
      </Explanation>
      <Choice
        label="Your vegetation prediction"
        value={vegetationPrediction}
        onChange={(value) => {
          setVegetationPrediction(value);
          setVegetationComplete(false);
          setPhase(0);
        }}
        options={[
          { value: "both", label: "Runoff and soil export both decrease" },
          { value: "runoff-only", label: "Only runoff decreases" },
          { value: "neither", label: "Neither decreases" },
        ]}
      />
      <ActionButton
        label="Compare vegetation cover"
        disabled={!vegetationPrediction || vegetationComplete}
        onPress={() => {
          setVegetationComplete(true);
          showTrial(RIVER_VEGETATION_COMPARISON[1]);
        }}
      />
      {vegetationComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {vegetationPrediction === "both" ? "matches" : "differs from"}
            {" your prediction. Bare: runoff "}
            {vegetationEvidence[0].runoffCubicMeters.toFixed(1)} m³ · soil moved{" "}
            {vegetationEvidence[0].soilMovedKilograms.toFixed(1)} kg · exported{" "}
            {vegetationEvidence[0].exportedKilograms.toFixed(1)} kg. 100% cover:
            runoff {vegetationEvidence[1].runoffCubicMeters.toFixed(1)} m³ ·
            soil moved {vegetationEvidence[1].soilMovedKilograms.toFixed(1)} kg
            · exported {vegetationEvidence[1].exportedKilograms.toFixed(1)} kg.
            Changed: {vegetationVariables.changed.join(", ")}. Held:{" "}
            {vegetationVariables.held.join(" · ")}.
          </Explanation>
          <View style={buttonRowStyle}>
            <ActionButton
              label="Show bare-ground evidence"
              variant="secondary"
              onPress={() => showTrial(RIVER_VEGETATION_COMPARISON[0])}
            />
            <ActionButton
              label="Show covered evidence"
              variant="secondary"
              onPress={() => showTrial(RIVER_VEGETATION_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text accessibilityRole="header" style={headingStyle}>
        2. Steepen the slope
      </Text>
      <Explanation>
        Change only catchment slope from 2% to 20%. What changes with 40 mm rain
        and 40% vegetation fixed?
      </Explanation>
      <Choice
        label="Your slope prediction"
        value={slopePrediction}
        onChange={(value) => {
          setSlopePrediction(value);
          setSlopeComplete(false);
          setPhase(0);
        }}
        options={[
          { value: "both", label: "Runoff and soil moved both increase" },
          { value: "soil-only", label: "Only soil moved increases" },
          { value: "neither", label: "Neither increases" },
        ]}
      />
      <ActionButton
        label="Compare catchment slopes"
        disabled={!slopePrediction || slopeComplete}
        onPress={() => {
          setSlopeComplete(true);
          showTrial(RIVER_SLOPE_COMPARISON[1]);
        }}
      />
      {slopeComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {slopePrediction === "soil-only" ? "matches" : "differs from"}
            {" your prediction. 2% slope: runoff "}
            {slopeEvidence[0].runoffCubicMeters.toFixed(1)} m³ · soil moved{" "}
            {slopeEvidence[0].soilMovedKilograms.toFixed(1)} kg · exported{" "}
            {slopeEvidence[0].exportedKilograms.toFixed(1)} kg. 20% slope:
            runoff {slopeEvidence[1].runoffCubicMeters.toFixed(1)} m³ · soil
            moved {slopeEvidence[1].soilMovedKilograms.toFixed(1)} kg · exported{" "}
            {slopeEvidence[1].exportedKilograms.toFixed(1)} kg. Changed:{" "}
            {slopeVariables.changed.join(", ")}. Held:{" "}
            {slopeVariables.held.join(" · ")}.
          </Explanation>
          <View style={buttonRowStyle}>
            <ActionButton
              label="Show 2% evidence"
              variant="secondary"
              onPress={() => showTrial(RIVER_SLOPE_COMPARISON[0])}
            />
            <ActionButton
              label="Show 20% evidence"
              variant="secondary"
              onPress={() => showTrial(RIVER_SLOPE_COMPARISON[1])}
            />
          </View>
        </>
      )}

      {freeExploration && (
        <>
          <Text accessibilityRole="header" style={headingStyle}>
            3. Explore one variable
          </Text>
          <Explanation>
            Restore the 5,000 kg soil baseline, change one input, then run equal
            one-storm trials.
          </Explanation>
          <Control
            label="Catchment slope (%)"
            value={result.catchmentSlopePercent}
            min={0}
            max={20}
            onChange={(catchmentSlopePercent) =>
              setInputs((current) => ({
                ...current,
                catchmentSlopePercent,
              }))
            }
          />
          <Control
            label="Rainfall in one hour (mm)"
            value={result.rainfallMillimeters}
            min={0}
            max={100}
            step={5}
            onChange={(rainfallMillimeters) =>
              setInputs((current) => ({ ...current, rainfallMillimeters }))
            }
          />
          <Control
            label="Vegetation cover (%)"
            value={result.vegetationCoverPercent}
            min={0}
            max={100}
            step={5}
            onChange={(vegetationCoverPercent) =>
              setInputs((current) => ({
                ...current,
                vegetationCoverPercent,
              }))
            }
          />
          <Control
            label="Sediment tracer phase (%)"
            value={phase}
            min={0}
            max={100}
            step={5}
            onChange={setPhase}
          />
          <Meter
            label="Next runoff"
            value={result.runoffCubicMeters}
            max={800}
            detail={`${result.runoffCubicMeters.toFixed(1)} m³`}
          />
          <Meter
            label="Next soil moved"
            value={result.soilMovedKilograms}
            max={800}
            detail={`${result.soilMovedKilograms.toFixed(1)} kg`}
            color="#9b6b3f"
          />
          <ActionButton
            label="Run one storm"
            onPress={() =>
              setLedger((current) => applyRiverStorm(inputs, current))
            }
          />
          <ActionButton
            label="Restore soil"
            variant="secondary"
            onPress={() => setLedger(freshLedger())}
          />
          <Explanation>
            Storm {ledger.stormCount}. Soil ledger:{" "}
            {ledger.soilRemainingKilograms.toFixed(1)} kg remaining +{" "}
            {ledger.depositedKilograms.toFixed(1)} kg deposited +{" "}
            {ledger.exportedKilograms.toFixed(1)} kg exported = 5,000.0 kg.
            Sediment-tracer position is schematic, not measured speed.
          </Explanation>
        </>
      )}

      <ModelNote>
        Model boundary: one uniform one-hour storm over 1 hectare, 5,000 kg
        available soil and an invented 180 m³/h channel capacity. One millimeter
        over one hectare is 10 m³ water. Runoff, erosion and export coefficients
        are teaching assumptions, not field measurements, a river simulation or
        a flood forecast. Soil type, changing rain, groundwater, evaporation,
        storage, channel shape and sediment size are omitted. Terrain, flood
        width, vegetation, rills and grains are schematic.
      </ModelNote>
    </LearningFrame>
  );
}

const headingStyle = {
  color: colors.text,
  fontSize: 22,
  fontWeight: "800" as const,
};
const buttonRowStyle = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
};
