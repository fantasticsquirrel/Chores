import type { Trial } from "../physical-lesson";
import {
  defaultMachineState,
  machineResult,
  normalizeMachine,
  type MachineState,
} from "./model";
export const experiments: Trial<MachineState>[] = [
  {
    title: "Rope sections",
    question:
      "With two supporting rope sections instead of one, what happens to the pulling force?",
    choices: ["Less force", "Same force", "More force"],
    controlled:
      "Keep the load at 40 kg and lift it 0.5 m. Compare one supporting section with two. Count the sections lifting the moving load, not the wheels.",
    before: { ...defaultMachineState, advantage: 1 },
    after: { ...defaultMachineState, advantage: 2 },
    change: "Use two sections",
    evidence:
      "Pulling force falls from 392.4 N to 196.2 N; rope pulled increases from 0.5 m to 1.0 m. Input and output work are both 196.2 J.",
    explain:
      "Why must you pull farther when less force lifts the same load through the same height? Use force × distance as evidence.",
  },
  {
    title: "Gear turns",
    question:
      "What happens to the number of crank turns when a 12-tooth driver turns a 48-tooth gear instead of a 12-tooth gear?",
    choices: ["More turns", "Same turns", "Fewer turns"],
    controlled:
      "Keep the load at 40 kg and lift at 0.5 m. Both the crank and rope drum have a 0.2 m radius. Change only the driven gear tooth count.",
    before: { ...defaultMachineState, mode: "gears", advantage: 1 },
    after: { ...defaultMachineState, mode: "gears", advantage: 4 },
    change: "Use 48 driven teeth",
    evidence:
      "Crank turns increase from 0.40 to 1.59; input torque falls from 78.48 to 19.62 N·m. Output torque stays at 78.48 N·m, and work stays at 196.2 J.",
    explain:
      "Torque is a turning effect. Why does a larger driven gear turn less per input turn while providing greater output torque than input torque?",
  },
];
