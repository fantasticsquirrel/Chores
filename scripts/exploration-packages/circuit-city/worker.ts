import { installLesson } from "../physical-lesson";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import { createCircuitScene } from "./circuitScene";
import { circuit, type CircuitMode } from "./model";
const initial = {
  mode: "series" as CircuitMode,
  voltage: 12,
  switch0: true,
  switch1: true,
  switch2: true,
};
const switches = (s: typeof initial) => [s.switch0, s.switch1, s.switch2];
const result = (s: typeof initial) => circuit(s.mode, s.voltage, switches(s));
installLesson<typeof initial>({
  initial,
  serialize: serializePhysical,
  title: "Does opening one switch stop every house?",
  introduction: "Compare one series path with three parallel paths.",
  build: (s) => {
    const r = result(s);
    return physicalScene(
      createCircuitScene({
        kind: "circuit",
        ...s,
        switches: switches(s),
        power: r.housePower,
        current: r.houseCurrent,
      }),
      "circuit",
    );
  },
  select: (s, index) =>
    index >= 0 && index < 3
      ? { ...s, [`switch${index}`]: !switches(s)[index] }
      : s,
  fields: [
    { id: "mode", label: "Wiring", options: ["series", "parallel"] },
    { id: "voltage", label: "Battery voltage (V)", min: 0, max: 18 },
    ...[0, 1, 2].map((i) => ({
      id: `switch${i}`,
      label: `House ${i + 1} switch closed`,
      toggle: true,
    })),
  ],
  describe: (s) => {
    const r = result(s);
    return `${s.mode} circuit; battery ${s.voltage} V. Total current ${r.totalCurrent.toFixed(2)} A, source power ${(s.voltage * r.totalCurrent).toFixed(2)} W. Houses 1–3 current ${r.houseCurrent.map((v) => v.toFixed(2)).join(", ")} A; voltage ${r.houseVoltage.map((v) => v.toFixed(2)).join(", ")} V; power ${r.housePower.map((v) => v.toFixed(2)).join(", ")} W. ${s.mode === "series" ? "One complete path carries the same current through every load. Opening any switch breaks it." : "Closed parallel branches each receive full battery voltage. Branch currents add at the battery."} Charge is conserved while energy is transferred.`;
  },
  trials: [
    {
      title: "Open house 2",
      question: "With house 2 open, can any other house receive energy?",
      choices: ["In series only", "In parallel only", "In both"],
      controlled:
        "Keep battery 12 V and house 2 open. Compare series with parallel; other switches stay closed.",
      before: { ...initial, switch1: false },
      after: { ...initial, switch1: false, mode: "parallel" },
      change: "Compare parallel",
      explain:
        "Which independent paths remain complete? Why is opening one branch different from interrupting the only series path?",
    },
    {
      title: "Change voltage",
      question:
        "With fixed resistance, does doubling voltage double or quadruple power?",
      choices: ["Double", "Quadruple"],
      controlled:
        "Keep all switches closed in parallel. Compare 6 V and 12 V with each house 12 Ω.",
      before: { ...initial, mode: "parallel", voltage: 6 },
      after: { ...initial, mode: "parallel", voltage: 12 },
      change: "Double voltage",
      explain:
        "Use I=V/R and P=VI. How did current and voltage each contribute to the power change?",
    },
  ],
  note: "Each house is a fixed 12 Ω resistor and a switch. Ideal battery/wires; window glow shows relative power and arrows conventional current. Real homes use parallel AC wiring and protective devices, not this low-voltage teaching model.",
});
