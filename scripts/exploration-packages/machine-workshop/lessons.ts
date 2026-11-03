import type { Trial } from "../physical-lesson";
import {
  defaultMachineState,
  machineResult,
  normalizeMachine,
  type MachineState,
} from "./model";
export const experiments: Trial<MachineState>[] = [
  {
    id: "pulley-sections",
    title: "Pulley sections",
    question:
      "If two rope sections support the load instead of one, what happens to the ideal pulling force and rope travel?",
    choices: [
      "Less force, more rope",
      "Same force and rope",
      "More force, less rope",
    ],
    correctChoice: "Less force, more rope",
    controlled:
      "Start with one supporting section, then change only to two. Count rope sections lifting the moving load—not pulley wheels.",
    before: { ...defaultMachineState, advantage: 1 },
    after: { ...defaultMachineState, advantage: 2 },
    change: "Use two sections",
    changed: "supporting rope sections, 1 to 2",
    held: ["40 kg load mass", "0.5 m lift height", "local gravity 9.81 m/s²"],
    evidence:
      "Ideal pulling force falls from 392.4 N to 196.2 N; rope travel rises from 0.5 m to 1.0 m. Ideal input work and the load's gravitational energy gain are both 196.2 J.",
    explain:
      "The same energy transfer is spread across twice the input distance, so the ideal input force is half as large. Why does this not mean the machine created energy?",
  },
  {
    id: "gear-ratio",
    title: "Gear ratio",
    question:
      "With the 12-tooth driver fixed, what happens to crank turns and hand force at the crank when the driven gear changes from 12 to 48 teeth?",
    choices: [
      "More crank turns, less hand force",
      "Same turns and force",
      "Fewer crank turns, more hand force",
    ],
    correctChoice: "More crank turns, less hand force",
    controlled:
      "Start with 12 driven teeth, then change only to 48. The driver stays at 12 teeth; crank and drum radii stay 0.20 m.",
    before: { ...defaultMachineState, mode: "gears", advantage: 1 },
    after: { ...defaultMachineState, mode: "gears", advantage: 4 },
    change: "Use 48 driven teeth",
    changed: "driven gear teeth, 12 to 48 (ratio 1:1 to 4:1)",
    held: [
      "40 kg load mass",
      "0.5 m lift height",
      "local gravity 9.81 m/s²",
      "12-tooth driver",
      "0.20 m crank and drum radii",
    ],
    evidence:
      "Crank turns rise from 0.40 to 1.59; ideal hand force at the crank falls from 392.4 N to 98.1 N; input torque falls from 78.48 to 19.62 N·m. Output torque stays 78.48 N·m and ideal work stays 196.2 J.",
    explain:
      "For the fixed load and drum, required output torque stays fixed. At 4:1, output torque is four times the input torque, so ideal input torque falls to one quarter while the driver makes four times as many turns for the same lift.",
  },
];
