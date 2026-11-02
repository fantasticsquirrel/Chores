import { createFrameCompactor } from "../shared/compact-frame";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import { createCircuitScene } from "./circuitScene";
import {
  CIRCUIT_DEFAULT_INPUTS,
  CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity,
  circuitStateAtPhase,
  compareCircuitTrials,
  normalizeCircuitInputs,
  type CircuitInputs,
  type CircuitSwitches,
} from "./model";

type PathPrediction = "" | "series-off" | "one-off" | "all-off";
type VoltagePrediction = "" | "quadratic" | "linear" | "unchanged";

const freshInputs = (): CircuitInputs => ({
  ...CIRCUIT_DEFAULT_INPUTS,
  switches: [...CIRCUIT_DEFAULT_INPUTS.switches],
});
const pathEvidence = CIRCUIT_SWITCH_COMPARISON.map(circuitActivity);
const voltageEvidence = CIRCUIT_VOLTAGE_COMPARISON.map(circuitActivity);
const pathVariables = compareCircuitTrials(...CIRCUIT_SWITCH_COMPARISON);
const voltageVariables = compareCircuitTrials(...CIRCUIT_VOLTAGE_COMPARISON);

let inputs = freshInputs();
let phase = 0;
let playing = false;
let pathPrediction: PathPrediction = "";
let voltagePrediction: VoltagePrediction = "";
let pathComplete = false;
let voltageComplete = false;

function reset() {
  inputs = freshInputs();
  phase = 0;
  playing = false;
  pathPrediction = "";
  voltagePrediction = "";
  pathComplete = false;
  voltageComplete = false;
}

function showTrial(trial: CircuitInputs) {
  const normalized = normalizeCircuitInputs(trial);
  inputs = { ...normalized, switches: [...normalized.switches] };
  phase = 0;
  playing = false;
}

function choosePath(prediction: PathPrediction) {
  pathPrediction = prediction;
  pathComplete = false;
  phase = 0;
  playing = false;
}

function chooseVoltage(prediction: VoltagePrediction) {
  voltagePrediction = prediction;
  voltageComplete = false;
  phase = 0;
  playing = false;
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control as string | undefined;
  const value = key ? input.values?.[key] : undefined;
  const unlocked = () => pathComplete && voltageComplete;

  if (key === "pathSeriesOff") choosePath("series-off");
  if (key === "pathOneOff") choosePath("one-off");
  if (key === "pathAllOff") choosePath("all-off");
  if (key === "comparePath" && pathPrediction) {
    pathComplete = true;
    showTrial(CIRCUIT_SWITCH_COMPARISON[1]);
  }
  if (key === "showSeries") showTrial(CIRCUIT_SWITCH_COMPARISON[0]);
  if (key === "showParallel") showTrial(CIRCUIT_SWITCH_COMPARISON[1]);

  if (key === "voltageQuadratic") chooseVoltage("quadratic");
  if (key === "voltageLinear") chooseVoltage("linear");
  if (key === "voltageUnchanged") chooseVoltage("unchanged");
  if (key === "compareVoltage" && voltagePrediction) {
    voltageComplete = true;
    showTrial(CIRCUIT_VOLTAGE_COMPARISON[1]);
  }
  if (key === "show6V") showTrial(CIRCUIT_VOLTAGE_COMPARISON[0]);
  if (key === "show12V") showTrial(CIRCUIT_VOLTAGE_COMPARISON[1]);

  if (unlocked() && input.type === "control" && Number.isFinite(value)) {
    if (key === "mode")
      inputs = {
        ...inputs,
        mode: Math.round(value) === 0 ? "series" : "parallel",
      };
    if (key === "voltage") inputs = { ...inputs, sourceVoltageVolts: value };
    if (key?.startsWith("switch")) {
      const index = Number(key.slice(6));
      if (Number.isInteger(index) && index >= 0 && index < 3) {
        const switches = [...inputs.switches] as unknown as boolean[];
        switches[index] = value === 1;
        inputs = {
          ...inputs,
          switches: switches as unknown as CircuitSwitches,
        };
      }
    }
    if (key === "phase") {
      phase = value / 100;
      playing = false;
    }
    inputs = normalizeCircuitInputs(inputs);
    if (key !== "phase") {
      phase = 0;
      playing = false;
    }
  }
  if (unlocked() && key === "play") playing = !playing;
  if (unlocked() && key === "start") {
    phase = 0;
    playing = false;
  }
  if (playing && Number.isFinite(input.dt) && input.dt > 0)
    phase = (phase + input.dt / 4) % 1;

  const result = circuitStateAtPhase(inputs, phase);
  const scene = physicalScene(
    createCircuitScene({
      kind: "circuit",
      mode: result.mode,
      switches: [...result.switches],
      power: result.housePowerWatts,
      current: result.houseCurrentAmperes,
      voltage: result.sourceVoltageVolts,
      phase: result.visualPhase,
    }),
    "circuit",
  );
  const scene3d = serializePhysical(scene, {
    title:
      result.mode === "series"
        ? "One path through three 12 Ω loads"
        : "Three independent 12 Ω branches",
    subtitle: `${result.sourceVoltageVolts.toFixed(1)} V ideal source · ${result.totalCurrentAmperes.toFixed(2)} A source current · ${result.sourcePowerWatts.toFixed(1)} W`,
    background: ["#10212b", "#18323a", "#10212b"],
  });
  scene.dispose();

  const freeExploration = unlocked();
  const buttons = [
    {
      id: "pathSeriesOff",
      label: "All off in series; houses 1 and 3 on in parallel",
      pressed: pathPrediction === "series-off",
    },
    {
      id: "pathOneOff",
      label: "Only house 2 is off in both",
      pressed: pathPrediction === "one-off",
    },
    {
      id: "pathAllOff",
      label: "All houses are off in both",
      pressed: pathPrediction === "all-off",
    },
    {
      id: "comparePath",
      label: "Compare series and parallel",
      disabled: !pathPrediction || pathComplete,
    },
    ...(pathComplete
      ? [
          { id: "showSeries", label: "Show series evidence" },
          { id: "showParallel", label: "Show parallel evidence" },
        ]
      : []),
    {
      id: "voltageQuadratic",
      label: "Current doubles; power and energy quadruple",
      pressed: voltagePrediction === "quadratic",
    },
    {
      id: "voltageLinear",
      label: "Current and power both double",
      pressed: voltagePrediction === "linear",
    },
    {
      id: "voltageUnchanged",
      label: "Current and power stay unchanged",
      pressed: voltagePrediction === "unchanged",
    },
    {
      id: "compareVoltage",
      label: "Compare 6 V and 12 V",
      disabled: !voltagePrediction || voltageComplete,
    },
    ...(voltageComplete
      ? [
          { id: "show6V", label: "Show 6 V evidence" },
          { id: "show12V", label: "Show 12 V evidence" },
        ]
      : []),
    ...(freeExploration
      ? [
          {
            id: "play",
            label: playing
              ? "Pause conventional current"
              : "Play conventional current",
          },
          { id: "start", label: "Start markers" },
        ]
      : []),
  ];

  const pathText = pathComplete
    ? `The evidence ${pathPrediction === "series-off" ? "matches" : "differs from"} your prediction. Series: ${pathEvidence[0].totalCurrentAmperes.toFixed(2)} A source current · houses ${pathEvidence[0].housePowerWatts.map((number) => number.toFixed(1)).join(", ")} W. Parallel: ${pathEvidence[1].totalCurrentAmperes.toFixed(2)} A source current · houses ${pathEvidence[1].housePowerWatts.map((number) => number.toFixed(1)).join(", ")} W. Changed: ${pathVariables.changed.join(", ")}. Held: ${pathVariables.held.join(" · ")}. Opening house 2 breaks the only series path; parallel branches 1 and 3 remain complete.`
    : "Keep an ideal 12 V source, house 2 open and houses 1 and 3 closed. Predict what changes between one series path and three parallel branches; every resistor stays 12 Ω.";
  const voltageText = voltageComplete
    ? `The evidence ${voltagePrediction === "quadratic" ? "matches" : "differs from"} your prediction. 6 V: each house ${voltageEvidence[0].houseCurrentAmperes[0].toFixed(2)} A · ${voltageEvidence[0].housePowerWatts[0].toFixed(1)} W · ${voltageEvidence[0].houseEnergyJoules[0].toFixed(1)} J in 10 s. 12 V: each house ${voltageEvidence[1].houseCurrentAmperes[0].toFixed(2)} A · ${voltageEvidence[1].housePowerWatts[0].toFixed(1)} W · ${voltageEvidence[1].houseEnergyJoules[0].toFixed(1)} J in 10 s. Changed: ${voltageVariables.changed.join(", ")}. Held: ${voltageVariables.held.join(" · ")}. For a fixed resistor, I = V ÷ R and P = V × I = V² ÷ R.`
    : "Keep all switches closed in parallel and each resistor fixed at 12 Ω. Predict what changes from 6 V to 12 V.";
  const loadEnergy = result.houseEnergyJoules.reduce(
    (sum, number) => sum + number,
    0,
  );
  const chargeDetail =
    result.mode === "parallel"
      ? `Branch charge ${result.houseChargeCoulombs.map((number) => number.toFixed(1)).join(" + ")} C = source charge.`
      : `The same ${result.sourceChargeCoulombs.toFixed(1)} C passes each series load.`;

  return {
    animate: playing,
    scene3d,
    shapes: [],
    description: `${result.mode} ideal direct-current circuit. Source ${result.sourceVoltageVolts.toFixed(1)} V; equivalent resistance ${result.equivalentResistanceOhms === null ? "open path" : result.equivalentResistanceOhms.toFixed(1) + " Ω"}; source current ${result.totalCurrentAmperes.toFixed(2)} A; source power ${result.sourcePowerWatts.toFixed(1)} W. Houses 1–3 current ${result.houseCurrentAmperes.map((number) => number.toFixed(2)).join(", ")} A; voltage ${result.houseVoltageVolts.map((number) => number.toFixed(1)).join(", ")} V; power ${result.housePowerWatts.map((number) => number.toFixed(1)).join(", ")} W. Charge in 10 s: ${result.sourceChargeCoulombs.toFixed(1)} C leaves the source and ${result.returnedChargeCoulombs.toFixed(1)} C returns. ${chargeDetail} Energy in 10 s: ${result.sourceEnergyJoules.toFixed(1)} J supplied = ${loadEnergy.toFixed(1)} J transferred. Charge is conserved; energy is transferred.`,
    readoutColumns: 4,
    readouts: [
      {
        label: "Equivalent resistance",
        value:
          result.equivalentResistanceOhms === null
            ? "Open path"
            : `${result.equivalentResistanceOhms.toFixed(1)} Ω`,
      },
      {
        label: "Source current",
        value: `${result.totalCurrentAmperes.toFixed(2)} A`,
      },
      {
        label: "Source power",
        value: `${result.sourcePowerWatts.toFixed(1)} W`,
      },
      {
        label: "Energy in 10 s",
        value: `${result.sourceEnergyJoules.toFixed(1)} J`,
      },
    ],
    controls: freeExploration
      ? [
          {
            id: "mode",
            label: "Wiring",
            kind: "select",
            options: [
              { value: 0, label: "Series" },
              { value: 1, label: "Parallel" },
            ],
            min: 0,
            max: 1,
            step: 1,
            value: result.mode === "series" ? 0 : 1,
          },
          {
            id: "voltage",
            label: "Ideal source voltage (V)",
            min: 0,
            max: 18,
            step: 1,
            value: result.sourceVoltageVolts,
          },
          ...result.switches.map((closed, index) => ({
            id: `switch${index}`,
            label: `House ${index + 1} switch closed`,
            kind: "toggle",
            min: 0,
            max: 1,
            step: 1,
            value: closed ? 1 : 0,
          })),
          {
            id: "phase",
            label: "Conventional-current marker phase (%)",
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
        heading: "1. Open one switch",
        text: pathText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("path") ||
              button.id === "comparePath" ||
              button.id === "showSeries" ||
              button.id === "showParallel",
          )
          .map((button) => button.id),
      },
      {
        heading: "2. Double the voltage",
        text: voltageText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("voltage") ||
              button.id === "compareVoltage" ||
              button.id === "show6V" ||
              button.id === "show12V",
          )
          .map((button) => button.id),
      },
      {
        heading: "3. Explore one variable",
        text: freeExploration
          ? "Controls are unlocked. Change one input, compare steady-state readings, then reset before another controlled trial. Marker motion is optional and does not change any measurement."
          : "Complete both fixed comparisons to unlock the wiring, switches, voltage and conventional-current marker controls.",
        buttonIds: buttons
          .filter((button) => button.id === "play" || button.id === "start")
          .map((button) => button.id),
      },
      {
        heading: "Explain the evidence",
        text: "Current is charge flow rate (A = C/s). Voltage is energy transferred per charge (V = J/C). Power is energy-transfer rate (W = J/s). Charge returns through the circuit while the source transfers energy to the loads.",
      },
    ],
    footnote:
      "Model boundary: a steady direct-current circuit with an ideal 0–18 V source, three fixed 12 Ω resistors and zero-resistance wires and switches. Source sag, battery depletion, heating, transients, component limits and protective devices are omitted. Moving markers show conventional-current direction, not individual charges or drift speed. Never test household mains wiring; use only classroom-approved low-voltage circuits with teacher or adult supervision.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
