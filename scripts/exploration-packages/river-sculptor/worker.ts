import { createFrameCompactor } from "../shared/compact-frame";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildRiver } from "./river";
import {
  RIVER_DEFAULT_INPUTS,
  RIVER_INITIAL_LEDGER,
  RIVER_SLOPE_COMPARISON,
  RIVER_VEGETATION_COMPARISON,
  applyRiverStorm,
  compareRiverTrials,
  normalizeRiverInputs,
  riverActivity,
  riverStateAtPhase,
  type RiverInputs,
  type RiverLedger,
} from "./model";

type VegetationPrediction = "" | "both" | "runoff-only" | "neither";
type SlopePrediction = "" | "both" | "soil-only" | "neither";

let inputs: RiverInputs = normalizeRiverInputs(RIVER_DEFAULT_INPUTS);
let ledger: RiverLedger = { ...RIVER_INITIAL_LEDGER };
let phase = 0;
let playing = false;
let vegetationPrediction: VegetationPrediction = "";
let slopePrediction: SlopePrediction = "";
let vegetationComplete = false;
let slopeComplete = false;

const vegetationEvidence = RIVER_VEGETATION_COMPARISON.map((trial) =>
  riverActivity(trial),
);
const slopeEvidence = RIVER_SLOPE_COMPARISON.map((trial) =>
  riverActivity(trial),
);
const vegetationVariables = compareRiverTrials(...RIVER_VEGETATION_COMPARISON);
const slopeVariables = compareRiverTrials(...RIVER_SLOPE_COMPARISON);

function reset() {
  inputs = normalizeRiverInputs(RIVER_DEFAULT_INPUTS);
  ledger = { ...RIVER_INITIAL_LEDGER };
  phase = 0;
  playing = false;
  vegetationPrediction = "";
  slopePrediction = "";
  vegetationComplete = false;
  slopeComplete = false;
}

function showTrial(trial: RiverInputs) {
  inputs = normalizeRiverInputs(trial);
  ledger = applyRiverStorm(inputs, { ...RIVER_INITIAL_LEDGER });
  phase = 0;
  playing = false;
}

function formatEvidence(
  label: string,
  evidence: ReturnType<typeof riverActivity>,
) {
  return `${label}: runoff ${evidence.runoffCubicMeters.toFixed(1)} m³ · infiltration ${evidence.infiltrationCubicMeters.toFixed(1)} m³ · soil moved ${evidence.soilMovedKilograms.toFixed(1)} kg · deposited ${evidence.depositedKilograms.toFixed(1)} kg · exported ${evidence.exportedKilograms.toFixed(1)} kg`;
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control as string | undefined;
  const value = key ? input.values?.[key] : undefined;
  const freeExploration = () => vegetationComplete && slopeComplete;

  if (key === "vegetationBoth") {
    vegetationPrediction = "both";
    vegetationComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "vegetationRunoff") {
    vegetationPrediction = "runoff-only";
    vegetationComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "vegetationNeither") {
    vegetationPrediction = "neither";
    vegetationComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "compareVegetation" && vegetationPrediction) {
    vegetationComplete = true;
    showTrial(RIVER_VEGETATION_COMPARISON[1]);
  }
  if (key === "showBare") showTrial(RIVER_VEGETATION_COMPARISON[0]);
  if (key === "showCovered") showTrial(RIVER_VEGETATION_COMPARISON[1]);

  if (key === "slopeBoth") {
    slopePrediction = "both";
    slopeComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "slopeSoil") {
    slopePrediction = "soil-only";
    slopeComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "slopeNeither") {
    slopePrediction = "neither";
    slopeComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "compareSlope" && slopePrediction) {
    slopeComplete = true;
    showTrial(RIVER_SLOPE_COMPARISON[1]);
  }
  if (key === "showGentle") showTrial(RIVER_SLOPE_COMPARISON[0]);
  if (key === "showSteep") showTrial(RIVER_SLOPE_COMPARISON[1]);

  if (freeExploration() && input.type === "control" && Number.isFinite(value)) {
    if (key === "slope") inputs.catchmentSlopePercent = value;
    if (key === "rain") inputs.rainfallMillimeters = value;
    if (key === "vegetation") inputs.vegetationCoverPercent = value;
    if (key === "phase") {
      phase = value / 100;
      playing = false;
    }
    inputs = normalizeRiverInputs(inputs);
  }
  if (freeExploration() && key === "storm") {
    ledger = applyRiverStorm(inputs, ledger);
    phase = 0;
    playing = false;
  }
  if (freeExploration() && key === "restore") {
    ledger = { ...RIVER_INITIAL_LEDGER };
    phase = 0;
    playing = false;
  }
  if (freeExploration() && key === "play") playing = !playing;
  if (freeExploration() && key === "start") {
    phase = 0;
    playing = false;
  }
  if (playing && Number.isFinite(input.dt) && input.dt > 0)
    phase = (phase + input.dt / 4) % 1;

  const result = riverStateAtPhase(
    inputs,
    phase,
    ledger.soilRemainingKilograms,
  );
  const model = landscapeScene(
    buildRiver({
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
    }),
    "river",
  );
  const scene3d = serializeLandscape(model, {
    title: `${result.runoffCubicMeters.toFixed(0)} m³ runoff in the next storm`,
    subtitle: `${ledger.soilRemainingKilograms.toFixed(1)} kg soil remains after ${ledger.stormCount} storms`,
    background: ["#10212b", "#18323a", "#10212b"],
  });
  model.dispose();

  const unlocked = freeExploration();
  const buttons = [
    {
      id: "vegetationBoth",
      label: "Runoff and soil export both decrease",
      pressed: vegetationPrediction === "both",
    },
    {
      id: "vegetationRunoff",
      label: "Only runoff decreases",
      pressed: vegetationPrediction === "runoff-only",
    },
    {
      id: "vegetationNeither",
      label: "Neither decreases",
      pressed: vegetationPrediction === "neither",
    },
    {
      id: "compareVegetation",
      label: "Compare vegetation cover",
      disabled: !vegetationPrediction || vegetationComplete,
    },
    ...(vegetationComplete
      ? [
          { id: "showBare", label: "Show bare-ground evidence" },
          { id: "showCovered", label: "Show covered evidence" },
        ]
      : []),
    {
      id: "slopeBoth",
      label: "Runoff and soil moved both increase",
      pressed: slopePrediction === "both",
    },
    {
      id: "slopeSoil",
      label: "Only soil moved increases",
      pressed: slopePrediction === "soil-only",
    },
    {
      id: "slopeNeither",
      label: "Neither increases",
      pressed: slopePrediction === "neither",
    },
    {
      id: "compareSlope",
      label: "Compare catchment slopes",
      disabled: !slopePrediction || slopeComplete,
    },
    ...(slopeComplete
      ? [
          { id: "showGentle", label: "Show 2% evidence" },
          { id: "showSteep", label: "Show 20% evidence" },
        ]
      : []),
    ...(unlocked
      ? [
          { id: "storm", label: "Run one storm" },
          { id: "restore", label: "Restore soil" },
          {
            id: "play",
            label: playing ? "Pause sediment tracer" : "Play sediment tracer",
          },
          { id: "start", label: "Start tracer" },
        ]
      : []),
  ];

  const vegetationText = vegetationComplete
    ? `The evidence ${vegetationPrediction === "both" ? "matches" : "differs from"} your prediction. ${formatEvidence("Bare", vegetationEvidence[0])}. ${formatEvidence("100% cover", vegetationEvidence[1])}. Changed: ${vegetationVariables.changed.join(", ")}. Held: ${vegetationVariables.held.join(" · ")}. Cover increases infiltration and protects soil in this model, so less water runs off and less sediment leaves downstream.`
    : "Change only vegetation from 0% to 100%. Predict what happens during the same 40 mm storm on the same 8% slope.";
  const slopeText = slopeComplete
    ? `The evidence ${slopePrediction === "soil-only" ? "matches" : "differs from"} your prediction. ${formatEvidence("2% slope", slopeEvidence[0])}. ${formatEvidence("20% slope", slopeEvidence[1])}. Changed: ${slopeVariables.changed.join(", ")}. Held: ${slopeVariables.held.join(" · ")}. The teaching formula holds runoff fixed when rain and cover stay fixed; slope changes only the moved and exported soil terms.`
    : "Change only catchment slope from 2% to 20%. Predict what changes with 40 mm rain and 40% vegetation fixed.";
  const total =
    ledger.soilRemainingKilograms +
    ledger.depositedKilograms +
    ledger.exportedKilograms;

  return {
    animate: playing,
    scene3d,
    shapes: [],
    description: `Next one-hour storm on 1 hectare: ${result.rainfallMillimeters.toFixed(1)} mm rain, ${result.runoffCubicMeters.toFixed(1)} m³ runoff, ${result.infiltrationCubicMeters.toFixed(1)} m³ infiltration and ${result.channelCapacityExcessCubicMeters.toFixed(1)} m³ beyond the illustrative channel capacity. Soil moved ${result.soilMovedKilograms.toFixed(1)} kg: ${result.depositedKilograms.toFixed(1)} kg deposits and ${result.exportedKilograms.toFixed(1)} kg exits downstream. ${ledger.stormCount} storms applied. Soil remaining ${ledger.soilRemainingKilograms.toFixed(1)} kg; deposited ${ledger.depositedKilograms.toFixed(1)} kg; exported ${ledger.exportedKilograms.toFixed(1)} kg. Total ${total.toFixed(1)} kg. Sediment is transported, not destroyed.`,
    readoutColumns: 4,
    readouts: [
      {
        label: "Next runoff",
        value: `${result.runoffCubicMeters.toFixed(1)} m³`,
      },
      {
        label: "Next infiltration",
        value: `${result.infiltrationCubicMeters.toFixed(1)} m³`,
      },
      {
        label: "Next soil moved",
        value: `${result.soilMovedKilograms.toFixed(1)} kg`,
      },
      {
        label: "Soil remaining",
        value: `${ledger.soilRemainingKilograms.toFixed(1)} kg`,
      },
    ],
    controls: unlocked
      ? [
          {
            id: "slope",
            label: "Catchment slope (%)",
            min: 0,
            max: 20,
            step: 1,
            value: result.catchmentSlopePercent,
          },
          {
            id: "rain",
            label: "Rainfall in one hour (mm)",
            min: 0,
            max: 100,
            step: 1,
            value: result.rainfallMillimeters,
          },
          {
            id: "vegetation",
            label: "Vegetation cover (%)",
            min: 0,
            max: 100,
            step: 1,
            value: result.vegetationCoverPercent,
          },
          {
            id: "phase",
            label: "Sediment tracer phase (%)",
            min: 0,
            max: 100,
            step: 1,
            value: Math.round(result.visualPhase * 100),
          },
        ]
      : [],
    buttons,
    sections: [
      {
        heading: "1. Add vegetation",
        text: vegetationText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("vegetation") ||
              button.id === "compareVegetation" ||
              button.id === "showBare" ||
              button.id === "showCovered",
          )
          .map((button) => button.id),
      },
      {
        heading: "2. Steepen the slope",
        text: slopeText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("slope") ||
              button.id === "compareSlope" ||
              button.id === "showGentle" ||
              button.id === "showSteep",
          )
          .map((button) => button.id),
      },
      {
        heading: "3. Explore one variable",
        text: unlocked
          ? "Controls are unlocked. Restore 5,000 kg starting soil and change one input before equal one-storm trials. Moving grains are slowed path markers, not measured sediment or water speed. Use the phase control for the same positions without motion."
          : "Complete both fixed comparisons to unlock the controls, soil ledger and optional sediment tracer.",
        buttonIds: buttons
          .filter((button) =>
            ["storm", "restore", "play", "start"].includes(button.id),
          )
          .map((button) => button.id),
      },
      {
        heading: "Explain the evidence",
        text: "Water that does not infiltrate becomes runoff in this model. Runoff detaches and transports soil; some deposits in the reach and the rest exits downstream. Erosion moves material rather than making it disappear.",
      },
    ],
    footnote:
      "Model boundary: one uniform one-hour storm over a 1-hectare catchment, 5,000 kg available soil and an invented 180 m³/h channel capacity. One millimeter over one hectare is 10 m³ water. Runoff, erosion and export coefficients are teaching assumptions, not field measurements, a river simulation or a flood forecast. Soil type, changing rain, groundwater, evaporation, water storage, channel shape and sediment size are omitted. Terrain height, flood width, vegetation, rills and sediment grains are schematic.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
