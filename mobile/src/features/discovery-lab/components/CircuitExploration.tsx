import { Fragment, useState } from "react";
import {
  circuit,
  type CircuitMode,
} from "@family-manager/family-api/discovery-models/physical-world";
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

const houses = ["A", "B", "C"];
export function CircuitExploration() {
  const [mode, setMode] = useState<CircuitMode>("parallel");
  const [voltage, setVoltage] = useState(12);
  const [switches, setSwitches] = useState([true, true, true]);
  const model = circuit(mode, voltage, switches);
  return (
    <LearningFrame
      onReset={() => {
        setMode("parallel");
        setVoltage(12);
        setSwitches([true, true, true]);
      }}
    >
      <Diagram
        visualState={{
          kind: "circuit",
          mode,
          switches,
          power: model.housePower,
          current: model.houseCurrent,
          voltage,
        }}
        label={`${mode} circuit. ${houses.map((name, i) => `House ${name}: ${model.housePower[i].toFixed(1)} watts`).join(". ")}.`}
      >
        {(width) => (
          <>
            <DiagramLabel x={15} y={12}>
              {voltage} V battery · {mode} wiring
            </DiagramLabel>
            {mode === "parallel" ? (
              <>
                <Line x={30} y={50} x2={30} y2={190} />
                <Line x={width - 30} y={50} x2={width - 30} y2={190} />
                {houses.map((name, i) => (
                  <Line
                    key={name}
                    x={30}
                    y={65 + i * 55}
                    x2={width - 30}
                    y2={65 + i * 55}
                    color={switches[i] ? "#8be3d5" : "#71819d"}
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
            {houses.map((name, i) => {
              const x =
                mode === "parallel" ? width / 2 : 35 + ((width - 70) * i) / 2;
              const y = mode === "parallel" ? 65 + i * 55 : 105;
              return (
                <Fragment key={name}>
                  <Dot
                    key={`lamp-${name}`}
                    x={x}
                    y={y}
                    size={28}
                    color={model.housePower[i] > 0 ? "#ffe49b" : "#64748b"}
                  />
                  <DiagramLabel key={`label-${name}`} x={x - 8} y={y + 16}>
                    {name}
                  </DiagramLabel>
                </Fragment>
              );
            })}
          </>
        )}
      </Diagram>
      <Explanation>
        Total current from the battery: {model.totalCurrent.toFixed(2)} A.{" "}
        {mode === "parallel"
          ? "Each closed branch receives the full battery voltage; opening one switch leaves the other branches connected."
          : "The houses share one path. Opening any switch stops current through every house."}
      </Explanation>
      {houses.map((name, i) => (
        <Meter
          key={name}
          label={`House ${name}`}
          value={model.housePower[i]}
          max={12}
          detail={`${model.houseVoltage[i].toFixed(1)} V · ${model.houseCurrent[i].toFixed(2)} A · ${model.housePower[i].toFixed(2)} W`}
        />
      ))}
      <Choice
        label="Wiring"
        value={mode}
        onChange={setMode}
        options={[
          { value: "series", label: "Series" },
          { value: "parallel", label: "Parallel" },
        ]}
      />
      {houses.map((name, i) => (
        <ActionButton
          key={name}
          label={`${switches[i] ? "Open" : "Close"} house ${name} switch`}
          variant="secondary"
          onPress={() =>
            setSwitches(switches.map((value, j) => (i === j ? !value : value)))
          }
        />
      ))}
      <Control
        label="Battery voltage (V)"
        value={voltage}
        min={3}
        max={12}
        step={3}
        onChange={setVoltage}
      />
      <ModelNote>
        Each house is represented by a 12 Ω resistor. Current = voltage ÷
        resistance; power = current² × resistance. Wires and battery are ideal.
        Use low-voltage learning circuits, never household mains wiring.
      </ModelNote>
    </LearningFrame>
  );
}
