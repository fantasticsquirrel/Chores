import { Fragment, useEffect, useState } from "react";
import { Text } from "react-native";
import {
  CIRCUIT_DEFAULT_INPUTS,
  circuitStateAtPhase,
  normalizeCircuitInputs,
  type CircuitInputs,
  type CircuitMode,
  type CircuitSwitches,
} from "@family-manager/family-api/discovery-models/circuit";
import { ActionButton } from "../../../components/ActionButton";
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
import {
  CircuitPredictionSteps,
  type PathPrediction,
  type VoltagePrediction,
} from "./CircuitPredictionSteps";

const houses = ["A", "B", "C"];
const freshInputs = (): CircuitInputs => ({
  ...CIRCUIT_DEFAULT_INPUTS,
  switches: [...CIRCUIT_DEFAULT_INPUTS.switches],
});

export function CircuitExploration() {
  const [inputs, setInputs] = useState<CircuitInputs>(freshInputs);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pathPrediction, setPathPrediction] = useState<PathPrediction>("");
  const [voltagePrediction, setVoltagePrediction] =
    useState<VoltagePrediction>("");
  const [pathComplete, setPathComplete] = useState(false);
  const [voltageComplete, setVoltageComplete] = useState(false);
  const model = circuitStateAtPhase(inputs, phase / 100);
  const freeExploration = pathComplete && voltageComplete;
  const loadEnergy = model.houseEnergyJoules.reduce(
    (sum, value) => sum + value,
    0,
  );

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setPhase((current) => (current + 5) % 100),
      240,
    );
    return () => clearInterval(timer);
  }, [playing]);

  const showTrial = (trial: CircuitInputs) => {
    const normalized = normalizeCircuitInputs(trial);
    setInputs({ ...normalized, switches: [...normalized.switches] });
    setPhase(0);
    setPlaying(false);
  };
  const reset = () => {
    setInputs(freshInputs());
    setPhase(0);
    setPlaying(false);
    setPathPrediction("");
    setVoltagePrediction("");
    setPathComplete(false);
    setVoltageComplete(false);
  };
  const toggle = (index: number) => {
    setInputs((current) => ({
      ...current,
      switches: current.switches.map((closed, currentIndex) =>
        currentIndex === index ? !closed : closed,
      ) as unknown as CircuitSwitches,
    }));
    setPhase(0);
    setPlaying(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        visualState={{
          kind: "circuit",
          mode: model.mode,
          switches: [...model.switches],
          power: model.housePowerWatts,
          current: model.houseCurrentAmperes,
          voltage: model.sourceVoltageVolts,
          phase: model.visualPhase,
        }}
        label={[
          model.mode + " ideal direct-current circuit.",
          "Source " + model.sourceVoltageVolts.toFixed(1) + " volts.",
          "Source current " +
            model.totalCurrentAmperes.toFixed(2) +
            " amperes.",
          houses
            .map(
              (name, index) =>
                "House " +
                name +
                " switch " +
                (model.switches[index] ? "closed" : "open") +
                ", current " +
                model.houseCurrentAmperes[index].toFixed(2) +
                " amperes, voltage " +
                model.houseVoltageVolts[index].toFixed(1) +
                " volts, power " +
                model.housePowerWatts[index].toFixed(1) +
                " watts",
            )
            .join(". ") + ".",
          "Charge is conserved while energy is transferred.",
        ].join(" ")}
      >
        {(width) => (
          <>
            <DiagramLabel x={15} y={12}>
              {model.sourceVoltageVolts} V ideal source · {model.mode} wiring
            </DiagramLabel>
            {model.mode === "parallel" ? (
              <>
                <Line x={30} y={50} x2={30} y2={190} />
                <Line x={width - 30} y={50} x2={width - 30} y2={190} />
                {houses.map((name, index) => (
                  <Line
                    key={name}
                    x={30}
                    y={65 + index * 55}
                    x2={width - 30}
                    y2={65 + index * 55}
                    color={model.switches[index] ? "#8be3d5" : "#71819d"}
                  />
                ))}
              </>
            ) : (
              <>
                <Line x={30} y={105} x2={width - 30} y2={105} />
                <Line x={30} y={175} x2={width - 30} y2={175} />
                <Line x={30} y={105} x2={30} y2={175} />
                <Line x={width - 30} y={105} x2={width - 30} y2={175} />
              </>
            )}
            {houses.map((name, index) => {
              const x =
                model.mode === "parallel"
                  ? width / 2
                  : 35 + ((width - 70) * index) / 2;
              const y = model.mode === "parallel" ? 65 + index * 55 : 105;
              return (
                <Fragment key={name}>
                  <Dot
                    x={x}
                    y={y}
                    size={28}
                    color={
                      model.housePowerWatts[index] > 0 ? "#ffe49b" : "#64748b"
                    }
                  />
                  <DiagramLabel x={x - 8} y={y + 16}>
                    {name}
                  </DiagramLabel>
                </Fragment>
              );
            })}
          </>
        )}
      </Diagram>

      <Explanation>
        Total current from the battery: {model.totalCurrentAmperes.toFixed(2)}{" "}
        A. Source power: {model.sourcePowerWatts.toFixed(1)} W.{" "}
        {model.mode === "parallel"
          ? "Closed branches receive full source voltage; branch currents add at the source."
          : "One complete path carries the same current through every load; an open switch stops the path."}
      </Explanation>
      {houses.map((name, index) => (
        <Meter
          key={name}
          label={"House " + name}
          value={model.housePowerWatts[index]}
          max={27}
          detail={
            model.houseVoltageVolts[index].toFixed(1) +
            " V · " +
            model.houseCurrentAmperes[index].toFixed(2) +
            " A · " +
            model.housePowerWatts[index].toFixed(2) +
            " W"
          }
        />
      ))}

      <CircuitPredictionSteps
        pathPrediction={pathPrediction}
        voltagePrediction={voltagePrediction}
        pathComplete={pathComplete}
        voltageComplete={voltageComplete}
        onPathPrediction={(value) => {
          setPathPrediction(value);
          setPathComplete(false);
          setPhase(0);
          setPlaying(false);
        }}
        onVoltagePrediction={(value) => {
          setVoltagePrediction(value);
          setVoltageComplete(false);
          setPhase(0);
          setPlaying(false);
        }}
        onPathComplete={() => setPathComplete(true)}
        onVoltageComplete={() => setVoltageComplete(true)}
        onShowTrial={showTrial}
      />

      {freeExploration && (
        <>
          <Text accessibilityRole="header">3. Explore one variable</Text>
          <Explanation>
            Change one input at a time and compare steady-state readings. Reset
            before starting another controlled trial.
          </Explanation>
          <Choice
            label="Wiring"
            value={model.mode}
            onChange={(mode: CircuitMode) => {
              setInputs((current) => ({ ...current, mode }));
              setPhase(0);
              setPlaying(false);
            }}
            options={[
              { value: "series", label: "Series" },
              { value: "parallel", label: "Parallel" },
            ]}
          />
          {houses.map((name, index) => (
            <ActionButton
              key={name}
              label={
                (model.switches[index] ? "Open" : "Close") +
                " house " +
                name +
                " switch"
              }
              variant="secondary"
              onPress={() => toggle(index)}
            />
          ))}
          <Control
            label="Battery voltage (V)"
            value={model.sourceVoltageVolts}
            min={0}
            max={18}
            onChange={(sourceVoltageVolts) => {
              setInputs((current) => ({ ...current, sourceVoltageVolts }));
              setPhase(0);
              setPlaying(false);
            }}
          />
          <Control
            label="Conventional-current marker phase (%)"
            value={phase}
            min={0}
            max={100}
            step={5}
            onChange={(value) => {
              setPhase(value);
              setPlaying(false);
            }}
          />
          <ActionButton
            label={
              playing
                ? "Pause conventional current"
                : "Play conventional current"
            }
            variant="secondary"
            onPress={() => setPlaying((current) => !current)}
          />
          <ActionButton
            label="Start markers"
            variant="secondary"
            onPress={() => {
              setPhase(0);
              setPlaying(false);
            }}
          />
        </>
      )}

      <Explanation>
        Charge in 10 s: {model.sourceChargeCoulombs.toFixed(1)} C leaves the
        source and {model.returnedChargeCoulombs.toFixed(1)} C returns. Energy
        in 10 s: {model.sourceEnergyJoules.toFixed(1)} J supplied ={" "}
        {loadEnergy.toFixed(1)} J transferred to the loads. Charge is conserved;
        energy is transferred.
      </Explanation>
      <ModelNote>
        Current is charge flow rate (A = C/s). Voltage is energy transferred per
        charge (V = J/C). Power is energy transfer rate (W = J/s). This is a
        steady direct-current model with an ideal 0–18 V source, fixed 12 Ω
        resistors, and zero-resistance wires and switches. Source sag, battery
        depletion, heating, transients, component limits and protective devices
        are omitted. Moving markers show conventional-current direction, not
        individual charges or drift speed. Never test household mains wiring;
        use only classroom-approved low-voltage circuits with teacher or adult
        supervision.
      </ModelNote>
    </LearningFrame>
  );
}
